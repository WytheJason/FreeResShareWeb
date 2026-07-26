/**
 * 发布帖子接口
 * - 极验校验 + 防抖锁
 * - 校验标题/简介/分类/网盘链接/提取码
 * - 入库 posts 表
 */
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getCurrentUser, canPublish } from '@/lib/auth';
import { getCaptchaProvider } from '@/lib/geetest4';
import {
  sanitizeUserContent,
  isValidPanUrl,
  containsMaliciousLink,
  acquireSubmitLock,
  releaseSubmitLock,
  buildLockKey,
} from '@/lib/security';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  isValidPanCode,
} from '@/lib/utils';
import type { PostForm, PostCategory, PanType, CaptchaTicket } from '@/lib/types';

// 允许的分类与网盘类型白名单
const CATEGORY_WHITELIST: PostCategory[] = ['software', 'movie'];
const PAN_TYPE_WHITELIST: PanType[] = ['baidu', 'aliyun', 'quark'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      cover_url,
      category,
      pan_type,
      pan_url,
      pan_code,
      is_vip,
      captcha,
    } = body as PostForm & { captcha: CaptchaTicket };

    // ---------- 1. 登录 & 封禁校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!canPublish(user)) {
      return NextResponse.json(errorResponse('账号已被封禁，无法发布内容', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // ---------- 2. 极验票据校验 ----------
    if (!captcha) {
      return NextResponse.json(errorResponse('缺少人机验证票据', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }
    const provider = getCaptchaProvider();
    const verified = await provider.verifyTicket(captcha);
    if (!verified) {
      return NextResponse.json(errorResponse('人机验证失败', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // ---------- 3. 防抖锁（5 秒）----------
    const lockKey = buildLockKey(user.id, 'post-create');
    if (!acquireSubmitLock(lockKey, 5000)) {
      return NextResponse.json(errorResponse('提交过于频繁，请稍后重试', 429), {
        status: HTTP_STATUS.TOO_MANY_REQUESTS,
      });
    }

    try {
      // ---------- 4. 参数校验 ----------
      const safeTitle = (title ?? '').trim();
      if (!safeTitle || safeTitle.length > 100) {
        return NextResponse.json(errorResponse('标题长度需在 1-100 之间', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      const descRaw = description ?? '';
      if (descRaw.length > 2000) {
        return NextResponse.json(errorResponse('简介最多 2000 字', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      if (!category || !CATEGORY_WHITELIST.includes(category)) {
        return NextResponse.json(errorResponse('分类不合法', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      if (!pan_type || !PAN_TYPE_WHITELIST.includes(pan_type)) {
        return NextResponse.json(errorResponse('网盘类型不合法', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      if (!isValidPanUrl(pan_type, pan_url)) {
        return NextResponse.json(errorResponse('网盘链接格式不正确', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      if (!isValidPanCode(pan_code ?? '')) {
        return NextResponse.json(errorResponse('提取码格式不正确（0-8 位字母数字）', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      // ---------- 5. 内容安全处理 ----------
      const safeDescription = sanitizeUserContent(descRaw);
      if (containsMaliciousLink(safeDescription)) {
        return NextResponse.json(errorResponse('简介包含非法外链', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      // ---------- 6. 入库 ----------
      const supabase = await getSupabaseServer();
      const { data, error } = await supabase
        .from('posts')
        .insert({
          title: safeTitle,
          description: safeDescription,
          cover_url: (cover_url ?? '').trim(),
          category,
          pan_type,
          pan_url: pan_url.trim(),
          pan_code: (pan_code ?? '').trim(),
          is_vip: !!is_vip,
          author_id: user.id,
          status: 'normal',
        })
        .select('id')
        .single();

      if (error) {
        return NextResponse.json(errorResponse(error.message, 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      return NextResponse.json(
        successResponse({ id: data.id }, '发布成功'),
        { status: HTTP_STATUS.OK }
      );
    } finally {
      // 业务结束释放锁（无论成功失败）
      releaseSubmitLock(lockKey);
    }
  } catch (error) {
    console.error('[Post Create] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
