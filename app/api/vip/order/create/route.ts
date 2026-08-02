/**
 * VIP 订单创建接口
 * POST /api/vip/order/create
 *
 * 请求体：
 * - plan_id: 套餐ID（month / quarter / year / permanent）
 * - pay_type: 支付方式（alipay / wxpay / qqpay）
 *
 * 返回：
 * - pay_url: 易支付跳转 URL
 * - order_no: 订单号
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import { getVipPlan } from '@/lib/types';
import { createPaymentUrl, generateOrderNo, isEpayConfigured, isPayTypeAvailable, type EpayPayType } from '@/lib/epay';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    // 1. 检查登录状态
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('请先登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    if (user.is_banned) {
      return NextResponse.json(errorResponse('账号已被封禁', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // 2. 解析请求参数
    const body = await request.json();
    const { plan_id, pay_type } = body as { plan_id: string; pay_type: string };

    // 3. 校验套餐
    const plan = getVipPlan(plan_id);
    if (!plan) {
      return NextResponse.json(errorResponse('无效的套餐', 400), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // 4. 校验支付方式
    const validPayTypes: EpayPayType[] = ['alipay', 'wxpay', 'qqpay'];
    if (!validPayTypes.includes(pay_type as EpayPayType)) {
      return NextResponse.json(errorResponse('无效的支付方式', 400), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // 4.1 检查该支付方式是否可用（避免前端显示维护错误）
    if (!isPayTypeAvailable(pay_type as EpayPayType)) {
      return NextResponse.json(
        errorResponse('当前支付方式正在维护，请更换其他支付方式', 503),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }

    // 5. 检查易支付配置
    if (!isEpayConfigured()) {
      return NextResponse.json(
        errorResponse('支付服务未配置，请联系管理员', 503),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }

    // 6. 生成订单
    const orderNo = generateOrderNo();
    const admin = getSupabaseServiceAdmin();

    const { error: insertError } = await admin.from('vip_order').insert({
      order_no: orderNo,
      user_id: user.id,
      plan_id: plan.id,
      plan_name: plan.name,
      amount: plan.price,
      days: plan.days,
      plan_type: plan.type,
      pay_type: pay_type as string,
      status: 'pending',
    });

    if (insertError) {
      console.error('[VIP Order] 创建订单失败', insertError);
      return NextResponse.json(errorResponse('创建订单失败', 500), {
        status: HTTP_STATUS.INTERNAL_ERROR,
      });
    }

    // 7. 构造支付 URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://web.bestbzw.xyz';
    const result = createPaymentUrl({
      outTradeNo: orderNo,
      name: `VIP ${plan.name} - ${plan.days ? plan.days + '天' : '永久'}`,
      money: plan.price,
      payType: pay_type as EpayPayType,
      notifyUrl: `${siteUrl}/api/vip/order/notify`,
      returnUrl: `${siteUrl}/vip?order=${orderNo}`,
    });

    return NextResponse.json(
      successResponse({
        pay_url: result.payUrl,
        order_no: result.orderNo,
      }),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[VIP Order Create] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
