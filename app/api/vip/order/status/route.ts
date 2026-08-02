/**
 * VIP 订单状态查询接口
 * GET /api/vip/order/status?order_no=xxx
 *
 * 用于前端在支付完成后轮询订单状态
 * 返回订单当前状态和 VIP 开通结果
 * 同时负责清理过期的 pending 订单（超过 30 分钟未支付自动标记 expired）
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** 订单过期时间（毫秒）：30 分钟 */
const ORDER_EXPIRE_MS = 30 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('请先登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    const url = new URL(request.url);
    const orderNo = url.searchParams.get('order_no');

    if (!orderNo) {
      return NextResponse.json(errorResponse('缺少订单号', 400), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // 先自动清理一次该用户的过期 pending 订单（防止无效订单干扰）
    const expireBefore = new Date(Date.now() - ORDER_EXPIRE_MS).toISOString();
    await admin
      .from('vip_order')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .eq('user_id', user.id)
      .lt('created_at', expireBefore);

    // 查询订单（确保是当前用户的订单）
    const { data: order } = await admin
      .from('vip_order')
      .select('*')
      .eq('order_no', orderNo)
      .eq('user_id', user.id)
      .single();

    if (!order) {
      return NextResponse.json(errorResponse('订单不存在', 404), {
        status: HTTP_STATUS.NOT_FOUND,
      });
    }

    // 重新查询用户信息以获取最新 VIP 状态
    const { data: latestProfile } = await admin
      .from('user_profile')
      .select('is_vip, vip_expired_at')
      .eq('id', user.id)
      .single();

    // 内联 VIP 状态检查（避免类型不匹配）
    const vipActive = !!latestProfile?.is_vip && !!latestProfile?.vip_expired_at
      ? new Date(latestProfile.vip_expired_at).getTime() > Date.now()
      : false;

    // 根据状态生成不同提示
    let statusMessage = '';
    switch (order.status) {
      case 'paid':
        statusMessage = '支付成功，VIP 已开通';
        break;
      case 'pending':
        statusMessage = '等待支付完成...';
        break;
      case 'expired':
        statusMessage = '订单已过期，请重新下单';
        break;
      case 'failed':
        statusMessage = '支付失败，请重新下单';
        break;
    }

    return NextResponse.json(
      successResponse({
        order_no: order.order_no,
        status: order.status,
        status_message: statusMessage,
        plan_id: order.plan_id,
        plan_name: order.plan_name,
        amount: order.amount,
        paid_at: order.paid_at,
        // VIP 当前状态
        vip_active: vipActive,
        vip_expired_at: latestProfile?.vip_expired_at ?? null,
      }),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[VIP Order Status] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
