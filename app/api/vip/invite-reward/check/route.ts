/**
 * 邀请 VIP 奖励检查接口
 * GET /api/vip/invite-reward/check
 *
 * 检查当前用户的邀请人数是否达到奖励阶梯
 * - 查询已发放的奖励记录
 * - 若达到新阶梯但未发放，自动发放 VIP 天数
 *
 * 返回：
 * - tiers: 各阶梯的状态（已发放/未达成/可领取）
 * - invite_count: 当前邀请人数
 * - vip_expired_at: 当前 VIP 到期时间
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import { INVITE_VIP_REWARDS, type InviteVipRewardTier } from '@/lib/types';
import { calculateVipExpiry } from '@/lib/vip';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('请先登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // 1. 查询已发放的邀请VIP奖励记录
    const { data: grantedRewards } = await admin
      .from('invite_vip_reward')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'granted');

    const grantedMap = new Map<number, boolean>();
    (grantedRewards ?? []).forEach((r: { required_count: number }) => {
      grantedMap.set(r.required_count, true);
    });

    // 2. 遍历阶梯，检查是否可领取新奖励
    const tiers: Array<
      InviteVipRewardTier & {
        status: 'granted' | 'available' | 'locked';
        granted_at?: string;
      }
    > = [];

    let newlyGrantedDays = 0;

    for (const tier of INVITE_VIP_REWARDS) {
      const alreadyGranted = grantedMap.has(tier.required_count);
      const reached = user.invite_count >= tier.required_count;

      if (alreadyGranted) {
        const record = (grantedRewards ?? []).find(
          (r: { required_count: number; granted_at: string }) =>
            r.required_count === tier.required_count
        );
        tiers.push({
          ...tier,
          status: 'granted',
          granted_at: record?.granted_at,
        });
      } else if (reached) {
        // 达成但未发放，自动发放
        tiers.push({ ...tier, status: 'available' });
        newlyGrantedDays += tier.reward_days;
      } else {
        tiers.push({ ...tier, status: 'locked' });
      }
    }

    // 3. 如果有可领取的奖励，自动发放
    if (newlyGrantedDays > 0) {
      // 查询当前 VIP 状态
      const { data: profile } = await admin
        .from('user_profile')
        .select('is_vip, vip_started_at, vip_expired_at')
        .eq('id', user.id)
        .single();

      // 计算新的到期时间（叠加所有可领取的奖励天数）
      let currentExpiredAt = profile?.vip_expired_at ?? null;
      const isFirstTime = !profile?.is_vip || !profile?.vip_started_at;

      // 逐个发放奖励
      for (const tier of INVITE_VIP_REWARDS) {
        const alreadyGranted = grantedMap.has(tier.required_count);
        const reached = user.invite_count >= tier.required_count;

        if (!alreadyGranted && reached) {
          // 计算新的到期时间
          const newExpiredAt = calculateVipExpiry(currentExpiredAt, {
            days: tier.reward_days,
            type: 'limited',
            // 以下字段 calculateVipExpiry 不使用，但类型需要
            id: 'month',
            name: '',
            price: 0,
            desc: '',
          });

          // 更新 user_profile
          await admin
            .from('user_profile')
            .update({
              is_vip: true,
              vip_started_at: isFirstTime ? new Date().toISOString() : profile?.vip_started_at,
              vip_expired_at: newExpiredAt,
            })
            .eq('id', user.id);

          // 写入邀请VIP奖励记录（unique 约束防止重复）
          await admin.from('invite_vip_reward').insert({
            user_id: user.id,
            required_count: tier.required_count,
            reward_days: tier.reward_days,
            status: 'granted',
          });

          // 写入 VIP 日志
          await admin.from('vip_log').insert({
            user_id: user.id,
            operator_id: user.id,
            action: 'open',
            days: tier.reward_days,
            note: `邀请 ${tier.required_count} 人奖励 ${tier.reward_days} 天 VIP`,
          });

          currentExpiredAt = newExpiredAt;
        }
      }

      console.log('[Invite VIP Reward] 自动发放完成', {
        userId: user.id,
        totalDays: newlyGrantedDays,
      });
    }

    // 4. 查询最新用户信息
    const { data: latestProfile } = await admin
      .from('user_profile')
      .select('is_vip, vip_expired_at, invite_count')
      .eq('id', user.id)
      .single();

    // 内联 VIP 状态检查（避免类型不匹配）
    const vipActive = !!latestProfile?.is_vip && !!latestProfile?.vip_expired_at
      ? new Date(latestProfile.vip_expired_at).getTime() > Date.now()
      : false;

    return NextResponse.json(
      successResponse({
        tiers,
        invite_count: latestProfile?.invite_count ?? 0,
        vip_active: vipActive,
        vip_expired_at: latestProfile?.vip_expired_at ?? null,
        newly_granted_days: newlyGrantedDays,
      }),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[Invite VIP Reward] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
