/**
 * 用户资料接口
 * - GET 获取当前用户资料
 * - PUT 编辑本人资料（Turnstile 校验）
 */
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { verifyTurnstileToken, getTurnstileSecretKey } from '@/lib/turnstile';
import { sanitizeUserContent } from '@/lib/security';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  isValidNickname,
} from '@/lib/utils';
import type { CaptchaTicket } from '@/lib/types';

// ============ 获取当前用户资料 ============
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    return NextResponse.json(successResponse(user, '获取成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Auth Profile GET] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}

// ============ 编辑本人资料 ============
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { nickname, avatar, bio, captcha } = body as {
      nickname: string;
      avatar: string;
      bio: string;
      captcha: CaptchaTicket;
    };

    // ---------- 1. 登录校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    // ---------- 2. Turnstile 验证 ----------
    if (!captcha || !captcha.token) {
      return NextResponse.json(errorResponse('缺少人机验证票据', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }
    const secretKey = getTurnstileSecretKey();
    if (secretKey) {
      const verifyResult = await verifyTurnstileToken(captcha.token, secretKey);
      if (!verifyResult.success) {
        return NextResponse.json(errorResponse(`人机验证失败: ${verifyResult.error || '未知错误'}`, 403), {
          status: HTTP_STATUS.FORBIDDEN,
        });
      }
    }

    // ---------- 3. 参数校验 ----------
    if (!isValidNickname(nickname)) {
      return NextResponse.json(errorResponse('昵称格式不正确（1-20 位中英文数字下划线）', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    if (bio && bio.length > 200) {
      return NextResponse.json(errorResponse('个人简介最多 200 字', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // ---------- 4. 清理简介内容（XSS + 敏感词）----------
    const safeBio = sanitizeUserContent(bio ?? '');
    const safeAvatar = (avatar ?? '').trim();

    // ---------- 5. 仅本人可改（RLS 也会兜底）----------
    const supabase = await getSupabaseServer();
    const { error } = await supabase
      .from('user_profile')
      .update({
        nickname,
        avatar: safeAvatar,
        bio: safeBio,
      })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    return NextResponse.json(successResponse(null, '资料已更新'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Auth Profile PUT] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
