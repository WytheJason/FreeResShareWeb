/**
 * 积分兑现记录查询接口
 * GET /api/points/withdraw/list?page=1&page_size=10
 *
 * 返回当前用户的兑换记录列表（按时间倒序）
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS, calcPageRange, calcTotalPages } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('请先登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('page_size') ?? '10', 10)));

    const admin = getSupabaseServiceAdmin();
    const { from, to } = calcPageRange(page, pageSize);

    // 查询总数
    const { count } = await admin
      .from('points_withdraw')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // 查询分页数据
    const { data: records, error } = await admin
      .from('points_withdraw')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[Withdraw List] 查询失败:', error.message);
      return NextResponse.json(errorResponse('查询失败', 1), {
        status: HTTP_STATUS.INTERNAL_ERROR,
      });
    }

    const total = count ?? 0;
    return NextResponse.json(
      successResponse({
        list: records ?? [],
        total,
        page,
        page_size: pageSize,
        total_pages: calcTotalPages(total, pageSize),
      }),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[Withdraw List] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
