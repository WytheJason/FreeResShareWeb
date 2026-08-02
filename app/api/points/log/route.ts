/**
 * 积分流水分页查询接口
 * GET /api/points/log?page=1&page_size=20
 *
 * 返回当前用户的积分变动流水记录
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import type { PointLog } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('请先登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get('page_size') ?? String(PAGE_SIZE)) || PAGE_SIZE)
    );

    const admin = getSupabaseServiceAdmin();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count } = await admin
      .from('points_log')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    const logs = (data ?? []) as PointLog[];

    return NextResponse.json(
      successResponse({
        list: logs,
        total: count ?? 0,
        page,
        page_size: pageSize,
        total_pages: Math.ceil((count ?? 0) / pageSize),
      }),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[Points Log] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
