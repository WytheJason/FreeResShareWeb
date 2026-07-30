/**
 * Next.js Middleware
 * 功能：
 *  1. 轻量 IP 限流（基于 geo 的临时 IP，用 x-real-ip/x-forwarded-for 兜底）
 *  2. 请求日志（仅打印，避免写库阻塞）
 *  3. 统一安全头（X-Content-Type-Options/Referrer-Policy），专门兼容 Cloudflare Turnstile iframe
 *
 *  注意：
 *  - matcher 已排除 /_next 静态资源、/public 资源、/cdn-cgi/*（Turnstile 验证平台内部路径）
 *  - 不对响应做复杂改写，保证 Edge Runtime 轻量可用
 */
import { NextRequest, NextResponse } from 'next/server';

const LOG_ENABLED = false;

// ---------- 配置：轻量限流 ----------
// 计数器仅进程内有效（重启重置），仅用于节流防简单刷；Edge Runtime 下无 Map 共享
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 分钟
const RATE_LIMIT_MAX = 45; // 每分钟 45 次

// ---------- 配置：用户操作更强的限流（仅对 /api/auth/* /api/post/* /api/comment/*）----------
const AUTH_WRITE_LIMIT_MAX = 10;

// 提取"最可信"的客户端 IP
function extractIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    // 兜底
    (req as unknown as { ip?: string }).ip ||
    (req as unknown as { geo?: { ip?: string } }).geo?.ip ||
    '0.0.0.0'
  );
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // ---- 0. 预先放行静态路径（与 matcher 语义保持一致，避免意外）----
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/icon.svg') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/favicon.') ||
    url.pathname.startsWith('/cdn-cgi/') || // Turnstile 验证平台内部请求
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

  // 仅对写操作相关 API 做更强限流；读接口按普通限制
  const isAuthOrWrite =
    url.pathname.startsWith('/api/auth/') ||
    url.pathname.startsWith('/api/post/') ||
    url.pathname.startsWith('/api/comment/') ||
    url.pathname.startsWith('/api/announcement/');
  const limit = isAuthOrWrite ? AUTH_WRITE_LIMIT_MAX : RATE_LIMIT_MAX;

  if (bucket.count > limit) {
    const res = new NextResponse(
      JSON.stringify({ code: 429, message: '请求过于频繁，请稍后再试' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
    if (LOG_ENABLED) {
      console.warn(
        `[rate-limit] blocked ip=${ip} path=${url.pathname} count=${bucket.count}`
      );
    }
    return res;
  }

  // ---- 2. 正常放行 + 统一安全响应头 ----
  const res = NextResponse.next();

  // 基础安全头（保持简洁，不设置严格 CSP，避免破坏 Turnstile iframe postMessage）
  res.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy：使用 no-referrer-when-downgrade，Turnstile iframe 跨域通信依赖正确的 referrer
  // 之前的 strict-origin-when-cross-origin 会导致 Turnstile iframe 拿不到完整 referrer，触发 postMessage origin 校验失败
  res.headers.set('Referrer-Policy', 'no-referrer-when-downgrade');

  // 明确允许 Turnstile iframe 嵌入，frame-ancestors 放宽；X-Frame-Options 由 Next.js / 浏览器默认处理
  // 这里不设置 X-Frame-Options，否则会和 Turnstile 多层 iframe 冲突
  // Content-Security-Policy 的 frame-src 等也不在 Edge 层统一设置，改由 next.config.js headers 处理

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
