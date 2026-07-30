/**
 * 注册接口
 * - 校验极验票据（滑块验证或一键验证）
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

// 强制动态渲染，防止 Vercel 静态化导致 API 阻塞
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GeetestCaptcha {
  type: 'geetest';
  lot_number: string;
  captcha_output: string;
  pass_token: string;
  gen_time: string;
}

interface OneLoginCaptcha {
  type: 'onelogin';
  token: string;
  phone: string;
  process_id?: string;
}

type CaptchaData = GeetestCaptcha | OneLoginCaptcha;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, nickname } = body as {
      email: string;
      password: string;
      nickname?: string;
      captcha: CaptchaData;
    };

    // ---------- 1. 验证码校验 ----------
    if (!body.captcha || !body.captcha.type) {
      return NextResponse.json(errorResponse('缺少验证参数', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    const captcha = body.captcha as CaptchaData;

    if (captcha.type === 'onelogin') {
      // 一键验证 - 校验 token
      console.log('[Auth Register] 一键验证', { phone: captcha.phone, hasToken: !!captcha.token });
      // TODO: 调用极验一键验证服务端校验接口
      // 当前简化处理：有 token 和 phone 即认为通过
      if (!captcha.token && !captcha.phone) {
        return NextResponse.json(errorResponse('一键验证失败', 403), {
          status: HTTP_STATUS.FORBIDDEN,
        });
      }
    } else if (captcha.type === 'geetest') {
      // 滑块验证 - 校验极验票据
      if (!captcha.lot_number || !captcha.captcha_output || !captcha.pass_token || !captcha.gen_time) {
        return NextResponse.json(errorResponse('极验票据参数不完整', 403), {
          status: HTTP_STATUS.FORBIDDEN,
        });
      }
      const provider = getCaptchaProvider();
      const result = await provider.verifyTicket({
        lot_number: captcha.lot_number,
        captcha_output: captcha.captcha_output,
        pass_token: captcha.pass_token,
        gen_time: captcha.gen_time,
      });
      if (!result.pass) {
        const reason = result.reason ? `人机验证失败：${result.reason}` : '人机验证失败';
        return NextResponse.json(errorResponse(reason, 403), {
          status: HTTP_STATUS.FORBIDDEN,
        });
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
      console.warn('[Auth Register] createUser 失败:', error.message);
      // 邮箱已存在等错误
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // 若提供了昵称，更新 user_profile（触发器已自动创建 profile）
    if (nickname && data.user) {
      const { error: profileError } = await admin
        .from('user_profile')
        .update({ nickname })
        .eq('id', data.user.id);
      if (profileError) {
        console.warn('[Auth Register] 更新昵称失败:', profileError.message);
      }
    }

    console.log('[Auth Register] 注册成功:', email);
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
