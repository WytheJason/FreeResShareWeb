/**
 * 用户管理页（服务端组件）
 * - 服务端查询 user_profile 表分页
 * - 支持 ?page=&q= 查询参数
 * - 将初始数据传入客户端组件 UsersTable
 */

// 禁止缓存，确保增删改后数据立即同步
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { calcPageRange, calcTotalPages } from '@/lib/utils';
import type { UserProfile } from '@/lib/types';
import UsersTable from './UsersTable';

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  // 当前页码
  const page = Math.max(1, Number(searchParams.page ?? '1') || 1);
  // 搜索关键词（按邮箱/昵称）
  const q = (searchParams.q ?? '').trim();

  const admin = getSupabaseServiceAdmin();
  let query = admin.from('user_profile').select('*', { count: 'exact' });

  // 服务端模糊匹配邮箱或昵称（转义 PostgREST 特殊字符）
  if (q) {
    const safeQ = q.replace(/[,()\\.*]/g, ' ').trim();
    if (safeQ) {
      query = query.or(`email.ilike.%${safeQ}%,nickname.ilike.%${safeQ}%`);
    }
  }

  const { from, to } = calcPageRange(page, PAGE_SIZE);
  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, count } = await query;

  const total = count ?? 0;
  const users = (data ?? []) as UserProfile[];

  return (
    <UsersTable
      initialUsers={users}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      query={q}
    />
  );
}
