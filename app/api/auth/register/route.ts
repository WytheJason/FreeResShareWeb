/**
 * 注册接口
 * - 校验极验票据
 * - 校验邮箱与密码强度
 * - 调用 Supabase Auth admin.createUser 创建用户
 * - 触发器自动写入 user_profile
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCaptchaProvider } from '@/lib/geetest4';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  isValidEmail,
  isValidPassword,
  isValidNickname,
} from '@/lib/utils';
import type { CaptchaTicket } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, nickname } = body as {
      email: string;
      password: string;
      nickname?: string;
      captcha: CaptchaTicket;
    };

    // ---------- 1. 极验票据校验 ----------
    if (!body.captcha) {
      return NextResponse.json(errorResponse('缺少人机验证票据', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }
    const provider = getCaptchaProvider();
    const verified = await provider.verifyTicket(body.captcha);
    if (!verified) {
      return NextResponse.json(errorResponse('人机验证失败', 403), {
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
    // 昵称可选，若提供则校验
    if (nickname && !isValidNickname(nickname)) {
      return NextResponse.json(errorResponse('昵称格式不正确（1-20 位中英文数字下划线）', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // ---------- 3. 创建用户（service_role，绕过 RLS）----------
    const admin = getSupabaseServiceAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: nickname ? { nickname } : undefined,
    });

    if (error) {
      // 邮箱已存在等错误
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // 若提供了昵称，更新 user_profile（触发器已自动创建 profile）
    if (nickname && data.user) {
      await admin
        .from('user_profile')
        .update({ nickname })
        .eq('id', data.user.id);
    }

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
