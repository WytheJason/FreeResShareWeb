/**
 * Next.js Middleware
 * 功能：
 *  1. Supabase session 刷新（关键！@supabase/ssr 官方要求必须在 middleware 中配置）
 *    - 每次请求创建 Supabase 客户端，调用 getUser() 刷新过期的 access_token
 *    - 将刷新后的 session cookie 写入响应 Set-Cookie 头
 *    - 没有这一步，Server Component 中无法刷新 token，导致 getUser() 返回 null
 *  2. 轻量 IP 限流（基于 geo 的临时 IP，用 x-real-ip/x-forwarded-for 兜底）
 *  3. 统一安全头（X-Content-Type-Options/Referrer-Policy），专门兼容 Cloudflare Turnstile iframe
 *
 *  注意：
 *  - matcher 已排除 /_next 静态资源、/public 资源、/cdn-cgi/*（Turnstile 验证平台内部路径）
 *  - middleware 必须使用 Edge Runtime，不能引入 Node.js 专有模块
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const LOG_ENABLED = false;

// ---------- 配置：轻量限流 ----------
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 分钟
const RATE_LIMIT_MAX = 45; // 每分钟 45 次

// ---------- 配置：用户操作更强的限流 ----------
const AUTH_WRITE_LIMIT_MAX = 10;

// 提取"最可信"的客户端 IP
function extractIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    (req as unknown as { ip?: string }).ip ||
    (req as unknown as { geo?: { ip?: string } }).geo?.ip ||
    '0.0.0.0'
  );
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // ---- 0. 预先放行静态路径 ----
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/icon.svg') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/favicon.') ||
    url.pathname.startsWith('/cdn-cgi/') ||
    url.pathname.startsWith('/robots.txt') ||
    url.pathname.startsWith('/sitemap.xml')
  ) {
    return NextResponse.next();
  }

  // ---- 1. IP 限流 ----
  const ip = extractIp(req);
  const now = Date.now();
  const prev = rateLimit.get(ip);
  let bucket = prev;
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimit.set(ip, bucket);
  }
  bucket.count += 1;

  const isAuthOrWrite =
    url.pathname.startsWith('/api/auth/') ||
    url.pathname.startsWith('/api/post/') ||
    url.pathname.startsWith('/api/comment/') ||
    url.pathname.startsWith('/api/announcement/');
  const limit = isAuthOrWrite ? AUTH_WRITE_LIMIT_MAX : RATE_LIMIT_MAX;

  if (bucket.count > limit) {
    if (LOG_ENABLED) {
      console.warn(
        `[rate-limit] blocked ip=${ip} path=${url.pathname} count=${bucket.count}`
      );
    }
    return new NextResponse(
      JSON.stringify({ code: 429, message: '请求过于频繁，请稍后再试' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  // ---- 2. 准备响应对象（后续 Supabase cookie 刷新也要写入这个响应）----
  const res = NextResponse.next({
    request: { headers: req.headers },
  });

  // ---- 3. Supabase session 刷新（@supabase/ssr 官方要求）----
  // 创建 middleware 专用 Supabase 客户端
  // - getAll 从请求 cookie 读取
  // - setAll 同时写入请求 cookie（供后续 Route Handler / Server Component 使用）
  //   和响应 cookie（Set-Cookie 头返回浏览器）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // 写入请求 cookie，让后续的 Route Handler / Server Component 能读到刷新后的 token
            req.cookies.set(name, value);
            // 写入响应 cookie，让浏览器收到新的 Set-Cookie 头
            res.cookies.set(name, value, options);
          });
        },
      },
    });

    // getUser() 会：
    // 1. 从 cookie 读取 access_token
    // 2. 调用 Supabase Auth API 验证 token
    // 3. 如果 token 过期，用 refresh_token 刷新
    // 4. 刷新后通过 setAll 写入新的 cookie
    // 重要：不使用 getSession()，它只读本地不验证，可能返回过期/伪造的 session
    try {
      await supabase.auth.getUser();
    } catch (e) {
      // getUser 失败不阻塞请求，让后续逻辑自行处理未登录状态
      if (LOG_ENABLED) {
        console.warn('[middleware] supabase.auth.getUser() 失败:', (e as Error).message);
      }
    }
  }

  // ---- 4. 统一安全响应头 ----
  res.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy：使用 no-referrer-when-downgrade，兼容 Turnstile iframe 跨域通信
  res.headers.set('Referrer-Policy', 'no-referrer-when-downgrade');

  // Permissions-Policy：关闭敏感特性
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  if (LOG_ENABLED) {
    console.log(
      `[req] ${req.method} ${url.pathname}?${url.searchParams.toString().slice(0, 80)} ip=${ip} count=${bucket.count}`
    );
  }
  return res;
}

export const config = {
  // /cdn-cgi/* 必须排除，Turnstile 的验证平台脚本和挑战资源都走这条路径
  matcher: [
    '/((?!_next/static|_next/image|icon.svg|favicon.ico|robots.txt|sitemap.xml|images|cdn-cgi).*)',
  ],
};
