/**
 * 全局中间件
 * - 路由鉴权：拦截未登录用户访问受保护页面
 * - IP 限流：保护 API 接口免受 CC 攻击
 * - Vercel Edge Runtime 适配
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { checkRateLimit, getClientIp, cleanupRateLimitStore } from '@/lib/rate-limit';

/** cookiesToSet 参数类型 */
interface CookieEntry {
  name: string;
  value: string;
  options: CookieOptions;
}

// ============ 路由权限配置 ============

/** 需要登录才能访问的页面路径前缀 */
const PROTECTED_PATHS = ['/publish', '/user/', '/admin'];

/** 仅管理员可访问的页面路径前缀 */
const ADMIN_PATHS = ['/admin'];

/** 需要限流的 API 路径前缀 */
const RATE_LIMITED_API = ['/api/'];

/** 写操作 API 路径（更严格限流） */
const WRITE_API_PATTERNS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/post/create',
  '/api/comment/add',
  '/api/report/submit',
];

// ============ 中间件主入口 ============

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---------- 1. API 限流 ----------
  if (pathname.startsWith('/api/')) {
    const ip = getClientIp(request);
    cleanupRateLimitStore();

    // 写操作接口：更严格限流（30 次/分钟）
    const isWriteApi = WRITE_API_PATTERNS.some((p) => pathname === p);
    const result = checkRateLimit(ip, pathname, {
      windowMs: 60 * 1000,
      maxRequests: isWriteApi ? 30 : 60,
    });

    if (!result.allowed) {
      return NextResponse.json(
        {
          code: 429,
          message: `请求过于频繁，请 ${Math.ceil(result.resetInMs / 1000)} 秒后重试`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(result.resetInMs / 1000)),
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
  }

  // ---------- 2. 页面鉴权 ----------
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // 创建 Supabase 服务端客户端读取会话
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // 未配置 Supabase，放行（开发态）
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieEntry[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 未登录用户访问受保护页面 → 跳转登录页
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 查询用户 profile 检查封禁与管理员权限
    const { data: profile } = await supabase
      .from('user_profile')
      .select('is_admin, is_banned')
      .eq('id', user.id)
      .single();

    // 封禁用户拦截
    if (profile?.is_banned) {
      const unauthorizedUrl = new URL('/unauthorized', request.url);
      unauthorizedUrl.searchParams.set('reason', 'banned');
      return NextResponse.redirect(unauthorizedUrl);
    }

    // 管理员路由权限校验
    const isAdminRoute = ADMIN_PATHS.some((p) => pathname.startsWith(p));
    if (isAdminRoute && !profile?.is_admin) {
      const unauthorizedUrl = new URL('/unauthorized', request.url);
      unauthorizedUrl.searchParams.set('reason', 'no-permission');
      return NextResponse.redirect(unauthorizedUrl);
    }

    return response;
  } catch (error) {
    console.error('[Middleware] 鉴权异常', error);
    // 鉴权异常时放行，由页面/接口二次校验兜底
    return response;
  }
}

// ============ 匹配规则 ============

export const config = {
  matcher: [
    /*
     * 匹配所有路径，排除：
     * - _next/static、_next/image、favicon.ico
     * - public 静态资源
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
};
