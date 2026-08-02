/**
 * VIP 订单过期清理接口
 * POST /api/vip/order/expire
 *
 * 将超时的 pending 订单（创建超过 30 分钟仍未支付）标记为 expired
 * 防止无效订单长期占用资源
 *
 * 可通过 Vercel Cron 定时触发，或在订单状态查询时按需调用
 * 返回：本次清理的订单数量
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** 订单过期时间（毫秒）：30 分钟 */
const ORDER_EXPIRE_MS = 30 * 60 * 1000;

export async function POST() {
  try {
    const admin = getSupabaseServiceAdmin();
    const expireBefore = new Date(Date.now() - ORDER_EXPIRE_MS).toISOString();

    const { data, error } = await admin
      .from('vip_order')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('created_at', expireBefore)
      .select('id');

    if (error) {
      console.error('[VIP Order Expire] 更新失败', error);
      return NextResponse.json(
        errorResponse('清理过期订单失败', 500),
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    const expiredCount = data?.length ?? 0;
    if (expiredCount > 0) {
      console.log('[VIP Order Expire] 清理过期订单', { count: expiredCount });
    }

    return NextResponse.json(
      successResponse({ expired_count: expiredCount }),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[VIP Order Expire] 异常', error);
    return NextResponse.json(
      errorResponse('服务器异常', 500),
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
