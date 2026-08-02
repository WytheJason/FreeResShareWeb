/**
 * 邀请信息接口
 * GET /api/invite/info
 * 返回当前用户的邀请码、邀请链接、邀请人数、邀请获得的总积分、最近邀请记录
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import type { InviteInfo, InviteRelation } from '@/lib/types';

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

    // 查询最近 20 条邀请记录（联表被邀请人昵称和头像）
    const { data: invites } = await admin
      .from('invite_relation')
      .select(
        `id, inviter_id, invitee_id, invite_code, reward_points, status, created_at,
         invitee:user_profile!invite_relation_invitee_id_fkey(nickname, avatar)`
      )
      .eq('inviter_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const recentInvites: InviteRelation[] = ((invites ?? []) as unknown as Array<
      Omit<InviteRelation, 'invitee_nickname' | 'invitee_avatar'> & {
        invitee: { nickname: string; avatar: string } | null;
      }
    >).map((item) => ({
      id: item.id,
      inviter_id: item.inviter_id,
      invitee_id: item.invitee_id,
      invite_code: item.invite_code,
      reward_points: item.reward_points,
      status: item.status,
      created_at: item.created_at,
      invitee_nickname: item.invitee?.nickname ?? '匿名用户',
      invitee_avatar: item.invitee?.avatar ?? '',
    }));

    // 计算邀请获得的总积分
    const totalInvitePoints = recentInvites
      .filter((r) => r.status === 'success')
      .reduce((sum, r) => sum + r.reward_points, 0);

    // 构建邀请链接
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://web.bestbzw.xyz';
    const inviteUrl = `${siteUrl}/login?invite=${user.invite_code ?? ''}`;

    const info: InviteInfo = {
      invite_code: user.invite_code ?? '',
      invite_url: inviteUrl,
      invite_count: user.invite_count ?? 0,
      total_invite_points: totalInvitePoints,
      recent_invites: recentInvites,
    };

    return NextResponse.json(successResponse(info), { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error('[Invite Info] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
