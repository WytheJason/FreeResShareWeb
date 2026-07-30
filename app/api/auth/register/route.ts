/**
 * 注册接口
 * - 校验 Cloudflare Turnstile token
 * - 校验邮箱与密码强度
 * - 调用 Supabase Auth admin.createUser 创建用户
 * - 触发器自动写入 user_profile
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
    const { email, password, nickname } = body as {
      email: string;
      password: string;
      nickname?: string;
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

    // ---------- 3. 创建用户 ----------
    const admin = getSupabaseServiceAdmin();
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

    // 更新昵称
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
