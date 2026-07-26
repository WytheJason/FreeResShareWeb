/**
 * Supabase 服务端客户端
 * 用于 Server Components、Route Handlers、Middleware
 * 通过 cookies 适配 SSR 会话
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
        } catch {
          // 在 Server Component 中调用 set 会抛错，可忽略
          // 仅在 Route Handler / Server Action 中生效
        }
      },
    },
  });
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
