/**
 * 注册接口
 * - 校验 Cloudflare Turnstile token
 * - 校验邮箱与密码强度
 * - 调用 Supabase Auth admin.createUser 创建用户
 * - 触发器自动写入 user_profile
 * - 支持邀请码追踪：绑定邀请关系，给邀请人和新用户发放积分奖励
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { verifyTurnstileToken, getTurnstileSecretKey } from '@/lib/turnstile';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  isValidEmail,
  isValidPassword,
  isValidNickname,
} from '@/lib/utils';
import { POINT_RULES } from '@/lib/types';

// 强制动态渲染，防止 Vercel 静态化导致 API 阻塞
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TurnstileCaptcha {
  type: 'turnstile';
  token: string;
}

type CaptchaData = TurnstileCaptcha;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, nickname, invite_code } = body as {
      email: string;
      password: string;
      nickname?: string;
      invite_code?: string;
      captcha: CaptchaData;
    };

    // ---------- 1. Turnstile 验证 ----------
    if (!body.captcha || !body.captcha.type) {
      return NextResponse.json(errorResponse('缺少验证参数', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    const captcha = body.captcha as CaptchaData;

    if (captcha.type === 'turnstile') {
      if (!captcha.token) {
        return NextResponse.json(errorResponse('缺少验证 token', 403), {
          status: HTTP_STATUS.FORBIDDEN,
        });
      }

      const secretKey = getTurnstileSecretKey();
      if (!secretKey) {
        console.warn('[Auth Register] 未配置 TURNSTILE_SECRET_KEY，跳过验证');
      } else {
        const result = await verifyTurnstileToken(captcha.token, secretKey);
        if (!result.success) {
          return NextResponse.json(errorResponse(`人机验证失败: ${result.error || '未知错误'}`, 403), {
            status: HTTP_STATUS.FORBIDDEN,
          });
        }
      }
    } else {
      return NextResponse.json(errorResponse('不支持的验证类型', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // ---------- 2. 参数校验 ----------
    if (!isValidEmail(email)) {
      return NextResponse.json(errorResponse('邮箱格式不正确', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    const pwdCheck = isValidPassword(password);
    if (!pwdCheck.valid) {
      return NextResponse.json(errorResponse(pwdCheck.message ?? '密码不合法', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    if (nickname && !isValidNickname(nickname)) {
      return NextResponse.json(errorResponse('昵称格式不正确（1-20 位中英文数字下划线）', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // ---------- 3. 预查邀请人（如果填了邀请码）----------
    const admin = getSupabaseServiceAdmin();
    let inviterId: string | null = null;

    if (invite_code && typeof invite_code === 'string') {
      const code = invite_code.trim().toUpperCase();
      if (code.length > 0 && code.length <= 20) {
        const { data: inviter } = await admin
          .from('user_profile')
          .select('id, invite_code')
          .eq('invite_code', code)
          .maybeSingle();

        if (inviter) {
          inviterId = inviter.id;
        }
        // 邀请码无效时不阻断注册，只是不发放邀请奖励
      }
    }

    // ---------- 4. 创建用户 ----------
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: nickname ? { nickname } : undefined,
    });

    if (error) {
      console.warn('[Auth Register] createUser 失败:', error.message);
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const newUserId = data.user!.id;

    // ---------- 5. 更新昵称 + 绑定邀请人 ----------
    const updateData: Record<string, unknown> = {};
    if (nickname) updateData.nickname = nickname;
    if (inviterId) updateData.invited_by = inviterId;

    if (Object.keys(updateData).length > 0) {
      const { error: profileError } = await admin
        .from('user_profile')
        .update(updateData)
        .eq('id', newUserId);
      if (profileError) {
        console.warn('[Auth Register] 更新资料失败:', profileError.message);
      }
    }

    // ---------- 6. 发放积分奖励 ----------
    // 6.1 新用户注册奖励
    try {
      await admin.rpc('change_user_points', {
        p_user_id: newUserId,
        p_amount: POINT_RULES.REGISTER_REWARD,
        p_action: 'register',
        p_note: '注册成功奖励',
      });
    } catch (e) {
      console.warn('[Auth Register] 注册奖励发放失败:', (e as Error).message);
    }

    // 6.2 邀请奖励（邀请人 + 被邀请人）
    if (inviterId) {
      try {
        // 写入邀请关系
        await admin.from('invite_relation').insert({
          inviter_id: inviterId,
          invitee_id: newUserId,
          invite_code: invite_code!.trim().toUpperCase(),
          reward_points: POINT_RULES.INVITE_REWARD,
          status: 'success',
        });

        // 给邀请人加分
        await admin.rpc('change_user_points', {
          p_user_id: inviterId,
          p_amount: POINT_RULES.INVITE_REWARD,
          p_action: 'invite_reward',
          p_related_user_id: newUserId,
          p_note: `邀请用户注册奖励`,
        });

        // 更新邀请人的 invite_count（RPC 可能不存在，失败时降级手动更新）
        try {
          await admin.rpc('increment_invite_count', { p_user_id: inviterId });
        } catch {
          // 降级手动更新
        }

        // 给新用户额外加分（被邀请奖励）
        await admin.rpc('change_user_points', {
          p_user_id: newUserId,
          p_amount: POINT_RULES.INVITED_BONUS,
          p_action: 'invited_bonus',
          p_related_user_id: inviterId,
          p_note: '被邀请注册额外奖励',
        });
      } catch (e) {
        console.warn('[Auth Register] 邀请奖励发放失败:', (e as Error).message);
      }
    }

    console.log('[Auth Register] 注册成功:', email, inviterId ? `(邀请人: ${inviterId})` : '');
    return NextResponse.json(successResponse(null, '注册成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Auth Register] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
