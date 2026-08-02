/**
 * VIP 处理工具函数
 * - 开通/续费 VIP（限时和永久）
 * - 计算 VIP 到期时间
 */

import { getSupabaseServiceAdmin } from './supabase-server';
import type { VipPlan } from './types';

/** 永久 VIP 到期时间（2099-12-31T23:59:59Z） */
export const PERMANENT_VIP_EXPIRED_AT = '2099-12-31T23:59:59Z';

/**
 * 计算开通/续费后的 VIP 到期时间
 * - 永久套餐：返回 2099-12-31
 * - 限时套餐：若当前 VIP 未过期，在现有到期时间基础上延长；否则从当前时间开始计算
 */
export function calculateVipExpiry(
  currentExpiredAt: string | null,
  plan: VipPlan
): string {
  // 永久 VIP
  if (plan.type === 'permanent' || plan.days === null) {
    return PERMANENT_VIP_EXPIRED_AT;
  }

  const now = new Date();
  const days = plan.days;

  // 检查当前 VIP 是否有效
  let baseTime = now;
  if (currentExpiredAt) {
    const expired = new Date(currentExpiredAt);
    if (expired.getTime() > now.getTime()) {
      // 当前 VIP 未过期，在现有到期时间基础上延长
      baseTime = expired;
    }
  }

  // 计算新的到期时间
  const newExpiry = new Date(baseTime);
  newExpiry.setDate(newExpiry.getDate() + days);
  return newExpiry.toISOString();
}

/**
 * 为用户开通/续费 VIP
 * - 更新 user_profile 的 is_vip / vip_started_at / vip_expired_at
 * - 写入 vip_log（操作日志）
 *
 * @param userId 用户ID
 * @param plan 套餐信息
 * @param note 操作备注
 * @param operatorId 操作人ID（在线支付时与 userId 相同）
 */
export async function activateVip(
  userId: string,
  plan: VipPlan,
  note: string,
  operatorId?: string
): Promise<void> {
  const admin = getSupabaseServiceAdmin();

  // 1. 查询当前用户 VIP 状态
  const { data: profile } = await admin
    .from('user_profile')
    .select('is_vip, vip_started_at, vip_expired_at')
    .eq('id', userId)
    .single();

  const currentExpiredAt = profile?.vip_expired_at ?? null;
  const newExpiredAt = calculateVipExpiry(currentExpiredAt, plan);

  // 判断是否是首次开通（用于设置 vip_started_at）
  const isFirstTime = !profile?.is_vip || !profile?.vip_started_at;

  // 2. 更新 user_profile
  const { error: updateError } = await admin
    .from('user_profile')
    .update({
      is_vip: true,
      vip_started_at: isFirstTime ? new Date().toISOString() : profile?.vip_started_at,
      vip_expired_at: newExpiredAt,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[VIP] 开通失败', updateError);
    throw new Error('VIP 开通失败：' + updateError.message);
  }

  // 3. 写入 vip_log
  const action = plan.type === 'permanent' ? 'open' : isFirstTime ? 'open' : 'renew';
  await admin.from('vip_log').insert({
    user_id: userId,
    operator_id: operatorId ?? userId,
    action,
    days: plan.days ?? 0,
    note,
  });
}
