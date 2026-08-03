/**
 * 登录接口
 * - 校验 Cloudflare Turnstile token
 * - 调用 Supabase Auth signInWithPassword
 * - 返回用户基本信息
 *
 * 重要：signInWithPassword 后必须等待 onAuthStateChange 回调完成，
 * 否则 session cookie 不会被写入响应的 Set-Cookie 头。
 */
import { NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseServiceAdmin, waitForAuthCookieFlush } from '@/lib/supabase-server';
import { verifyTurnstileToken, getTurnstileSecretKey } from '@/lib/turnstile';
import { successResponse, errorResponse, HTTP_STATUS, isValidEmail } from '@/lib/utils';

// 强制动态渲染，防止 Vercel 静态化导致 API 阻塞
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TurnstileCaptcha {
  type: 'turnstile';
  token: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, captcha } = body as {
      email: string;
      password: string;
      captcha?: TurnstileCaptcha;
    };

    // ---------- 1. Turnstile 验证 ----------
    if (!captcha || !captcha.type || captcha.type !== 'turnstile') {
      return NextResponse.json(errorResponse('缺少验证参数', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }
    if (!captcha.token) {
      return NextResponse.json(errorResponse('请先完成人机验证', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    const secretKey = getTurnstileSecretKey();
    if (!secretKey) {
      console.warn('[Auth Login] 未配置 TURNSTILE_SECRET_KEY，跳过验证');
    } else {
      const result = await verifyTurnstileToken(captcha.token, secretKey);
      if (!result.success) {
        return NextResponse.json(errorResponse(`人机验证失败: ${result.error || '未知错误'}`, 403), {
          status: HTTP_STATUS.FORBIDDEN,
        });
      }
    }

    // ---------- 2. 参数校验 ----------
    if (!isValidEmail(email)) {
      return NextResponse.json(errorResponse('邮箱格式不正确', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    if (!password) {
      return NextResponse.json(errorResponse('密码不能为空', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // ---------- 调用 Supabase 登录 ----------
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(errorResponse('邮箱或密码错误', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    // 查询用户 profile（含封禁状态等）—— 使用 admin 绕过 RLS 避免递归
    const admin = getSupabaseServiceAdmin();
    const { data: profile } = await admin
      .from('user_profile')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profile?.is_banned) {
      // 封禁用户不允许登录使用接口（已签发会话由后续接口拦截）
      return NextResponse.json(errorResponse('账号已被封禁', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // 关键：等待 @supabase/ssr 的 onAuthStateChange 异步回调完成
    // 回调内部通过 applyServerStorage → setAll → cookieStore.set() 设置 session cookie
    // 使用 setTimeout(0) 宏任务等待所有微任务（含 getAll/setAll 的 await）执行完毕
    // 确保 Set-Cookie 头被正确写入响应
    await waitForAuthCookieFlush();

    return NextResponse.json(
      successResponse(
        {
          id: data.user.id,
          email: data.user.email,
          nickname: profile?.nickname ?? '',
          avatar: profile?.avatar ?? '',
          is_admin: profile?.is_admin ?? false,
          is_vip: profile?.is_vip ?? false,
        },
        '登录成功'
      ),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[Auth Login] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
