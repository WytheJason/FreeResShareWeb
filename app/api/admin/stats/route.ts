/**
 * 后台数据统计接口
 * - 必须管理员
 * - 使用 service_role 单独 count 查询各项数据
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import type { AdminStats } from '@/lib/types';

export async function GET() {
  try {
    // ---------- 1. 管理员校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!isAdmin(user)) {
      return NextResponse.json(errorResponse('无权访问，仅管理员可访问', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // ---------- 2. 计算今日 0 点时间戳 ----------
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStartIso = todayStart.toISOString();

    // ---------- 3. 各项 count 查询（并行执行）----------
    const [
      usersRes,
      postsRes,
      commentsRes,
      vipRes,
      todayUsersRes,
      todayPostsRes,
      todayCommentsRes,
      pendingReportsRes,
    ] = await Promise.all([
      admin.from('user_profile').select('id', { count: 'exact', head: true }),
      admin.from('posts').select('id', { count: 'exact', head: true }),
      admin.from('comments').select('id', { count: 'exact', head: true }),
      admin.from('user_profile').select('id', { count: 'exact', head: true }).eq('is_vip', true),
      admin.from('user_profile').select('id', { count: 'exact', head: true }).gte('created_at', todayStartIso),
      admin.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', todayStartIso),
      admin.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', todayStartIso),
      admin.from('report').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    const stats: AdminStats = {
      total_users: usersRes.count ?? 0,
      total_posts: postsRes.count ?? 0,
      total_comments: commentsRes.count ?? 0,
      total_vip: vipRes.count ?? 0,
      today_new_users: todayUsersRes.count ?? 0,
      today_new_posts: todayPostsRes.count ?? 0,
      today_new_comments: todayCommentsRes.count ?? 0,
      pending_reports: pendingReportsRes.count ?? 0,
    };

    return NextResponse.json(successResponse(stats, '查询成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Admin Stats] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
