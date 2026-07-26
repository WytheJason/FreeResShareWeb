/**
 * Supabase 浏览器端客户端
 * 用于客户端组件中的认证、数据查询、Storage 上传
 */
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 单例 Supabase 浏览器客户端
 * 避免热更新时重复创建连接
 */
let browserClient: SupabaseClient | null = null;

/**
 * 获取 Supabase 浏览器端客户端单例
 * 必须在客户端组件中调用
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[Supabase Browser] 缺少环境变量：NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
