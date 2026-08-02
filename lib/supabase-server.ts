/**
 * Supabase 服务端客户端
 * 用于 Server Components、Route Handlers、Middleware
 * 通过 cookies 适配 SSR 会话
 *
 * 重要：
 * - @supabase/ssr 的 createServerClient 通过 onAuthStateChange 异步回调设置 cookie
 *   回调内部有 await getAll / await setAll，需要 2 个微任务才能完成
 *   在 Route Handler（如 /api/auth/login）调用 signInWithPassword 后，
 *   必须等待微任务队列清空，确保 cookie 已写入 cookieStore 后再返回响应
 * - Server Component 中 setAll 的 cookieStore.set() 会抛错（只读），被 catch 静默忽略
 *   因此必须配置 middleware 刷新 session（见 middleware.ts）
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

/** cookiesToSet 参数类型 */
interface CookieEntry {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * 获取 Supabase 服务端客户端（绑定用户会话，受 RLS 约束）
 * 用于读取当前登录用户、执行受 RLS 保护的查询
 */
export async function getSupabaseServer(): Promise<SupabaseClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[Supabase Server] 缺少环境变量：NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieEntry[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (e) {
          // 在 Server Component 中调用 set 会抛错，可忽略
          // 仅在 Route Handler / Server Action / Middleware 中生效
          // 不静默吞掉，便于排查 cookie 设置问题
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Supabase Server] cookie set 失败（Server Component 中正常）:', (e as Error).message);
          }
        }
      },
    },
  });
}

/**
 * 等待 onAuthStateChange 异步回调完成
 *
 * @supabase/ssr 的 createServerClient 在 signInWithPassword / signOut / token刷新 后，
 * 通过 onAuthStateChange → applyServerStorage → setAll 异步设置 cookie。
 * 回调内部有 2 个 await（getAll + setAll），需要 2+ 个微任务。
 *
 * 使用 setTimeout(0) 宏任务等待所有微任务执行完毕，
 * 确保 cookieStore.set() 在 Route Handler 返回响应前已完成。
 */
export function waitForAuthCookieFlush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * 获取 Supabase 服务端管理员客户端（使用 service_role，绕过 RLS）
 * 仅用于：管理员后台操作、VIP 操作、注册流程（创建 user_profile）
 * 严禁暴露给客户端
 */
export function getSupabaseServiceAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      '[Supabase Admin] 缺少环境变量：NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
