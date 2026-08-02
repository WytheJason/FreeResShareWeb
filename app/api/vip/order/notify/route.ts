/**
 * VIP 支付回调接口（易支付异步通知）
 * POST /api/vip/order/notify
 *
 * 易支付在用户支付完成后会向此地址发送 POST 通知
 * 通知格式为 application/x-www-form-urlencoded
 * 需验签后更新订单状态并开通 VIP
 *
 * 返回：成功返回 "success"，失败返回 "fail"（易支付要求纯文本）
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { parseNotify } from '@/lib/epay';
import { getVipPlan } from '@/lib/types';
import { activateVip } from '@/lib/vip';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    // 1. 解析表单数据（易支付以 form-urlencoded 发送）
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    // 2. 验签并解析通知
    const notify = parseNotify(params);
    if (!notify) {
      console.error('[VIP Notify] 验签失败');
      return new NextResponse('fail', { status: 200 });
    }

    const admin = getSupabaseServiceAdmin();

    // 3. 查询订单
    const { data: order } = await admin
      .from('vip_order')
      .select('*')
      .eq('order_no', notify.orderNo)
      .single();

    if (!order) {
      console.error('[VIP Notify] 订单不存在', notify.orderNo);
      return new NextResponse('fail', { status: 200 });
    }

    // 4. 检查订单状态（避免重复处理）
    if (order.status === 'paid') {
      console.log('[VIP Notify] 订单已处理，跳过', notify.orderNo);
      return new NextResponse('success', { status: 200 });
    }

    // 5. 校验金额
    const expectedAmount = Number(order.amount).toFixed(2);
    const receivedAmount = Number(notify.money).toFixed(2);
    if (expectedAmount !== receivedAmount) {
      console.error('[VIP Notify] 金额不匹配', {
        expected: expectedAmount,
        received: receivedAmount,
      });
      return new NextResponse('fail', { status: 200 });
    }

    // 6. 更新订单状态
    const { error: updateOrderError } = await admin
      .from('vip_order')
      .update({
        status: 'paid',
        trade_no: notify.tradeNo,
        paid_at: new Date().toISOString(),
      })
      .eq('order_no', notify.orderNo)
      .eq('status', 'pending'); // 乐观锁，确保只更新 pending 订单

    if (updateOrderError) {
      console.error('[VIP Notify] 更新订单失败', updateOrderError);
      return new NextResponse('fail', { status: 200 });
    }

    // 7. 开通 VIP
    const plan = getVipPlan(order.plan_id);
    if (!plan) {
      console.error('[VIP Notify] 套餐不存在', order.plan_id);
      return new NextResponse('fail', { status: 200 });
    }

    await activateVip(
      order.user_id,
      plan,
      `在线支付开通 VIP ${plan.name}（订单 ${notify.orderNo}）`,
      order.user_id // 在线支付时操作人与用户相同
    );

    console.log('[VIP Notify] 开通成功', {
      orderNo: notify.orderNo,
      userId: order.user_id,
      plan: plan.id,
    });

    // 8. 返回成功（易支付要求返回纯文本 "success"）
    return new NextResponse('success', { status: 200 });
  } catch (error) {
    console.error('[VIP Notify] 异常', error);
    return new NextResponse('fail', { status: 200 });
  }
}

/**
 * GET 请求处理（部分易支付可能用 GET 通知）
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const notify = parseNotify(params);
    if (!notify) {
      return new NextResponse('fail', { status: 200 });
    }

    // 复用 POST 逻辑
    return POST(
      new Request(request.url, {
        method: 'POST',
        body: new URLSearchParams(params),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
  } catch (error) {
    console.error('[VIP Notify GET] 异常', error);
    return new NextResponse('fail', { status: 200 });
  }
}
