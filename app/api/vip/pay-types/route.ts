/**
 * 支付方式列表接口
 * GET /api/vip/pay-types
 *
 * 返回当前所有可用的支付方式（基于环境变量 EPAY_DISABLED_TYPES）
 * 用于前端动态渲染支付方式选项，避免展示已维护的支付方式
 *
 * 返回：
 * - configured: 易支付是否已配置
 * - types: 可用的支付方式列表
 * - all_types: 所有支付方式（含维护中的）及其状态
 */
import { NextResponse } from 'next/server';
import { isEpayConfigured, isPayTypeAvailable, type EpayPayType, PAY_TYPE_LABELS } from '@/lib/epay';
import { successResponse } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const configured = isEpayConfigured();
  const allTypes: EpayPayType[] = ['alipay', 'wxpay', 'qqpay'];

  const detailed = allTypes.map((t) => ({
    type: t,
    label: PAY_TYPE_LABELS[t],
    available: configured && isPayTypeAvailable(t),
  }));

  const available = detailed.filter((d) => d.available).map((d) => d.type);

  return NextResponse.json(
    successResponse({
      configured,
      types: available,
      all_types: detailed,
    })
  );
}
