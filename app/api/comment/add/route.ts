/**
 * 新增评论接口
 * - Turnstile 校验 + 防抖锁
 * - 拦截空内容/纯符号
 * - 处理 reply_to_nickname
 * - 返回新建评论（含 user_nickname/user_avatar）
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser, canPublish } from '@/lib/auth';
import { verifyTurnstileToken, getTurnstileSecretKey } from '@/lib/turnstile';
import {
  sanitizeUserContent,
  isEmptyOrSymbolOnly,
  acquireSubmitLock,
  releaseSubmitLock,
  buildLockKey,
} from '@/lib/security';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import type { Comment, CaptchaTicket } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { post_id, content, parent_id, reply_to_id, captcha } = body as {
      post_id: string;
      content: string;
      parent_id?: string | null;
      reply_to_id?: string | null;
      captcha: CaptchaTicket;
    };

    // ---------- 1. 登录 & 封禁校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!canPublish(user)) {
      return NextResponse.json(errorResponse('账号已被封禁，无法评论', 403), {
        status: HTTP_STATUS.FORBIDDEN,
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

    // ---------- 3. 防抖锁（3 秒）----------
    const lockKey = buildLockKey(user.id, 'comment-add');
    if (!acquireSubmitLock(lockKey, 3000)) {
      return NextResponse.json(errorResponse('提交过于频繁，请稍后重试', 429), {
        status: HTTP_STATUS.TOO_MANY_REQUESTS,
      });
    }

    try {
      // ---------- 4. 参数校验 ----------
      if (!post_id) {
        return NextResponse.json(errorResponse('缺少 post_id', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      if (!content || isEmptyOrSymbolOnly(content)) {
        return NextResponse.json(errorResponse('评论内容不能为空或纯符号', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      if (content.length > 500) {
        return NextResponse.json(errorResponse('评论内容最多 500 字', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      const safeContent = sanitizeUserContent(content);

      const admin = getSupabaseServiceAdmin();

      // ---------- 5. 校验帖子存在 ----------
      const { data: post } = await admin
        .from('posts')
        .select('id')
        .eq('id', post_id)
        .single();
      if (!post) {
        return NextResponse.json(errorResponse('帖子不存在', 404), {
          status: HTTP_STATUS.NOT_FOUND,
        });
      }

      // ---------- 6. 处理 reply_to_nickname ----------
      let replyToNickname: string | null = null;
      if (reply_to_id) {
        const { data: replyTo } = await admin
          .from('comments')
          .select('user_id')
          .eq('id', reply_to_id)
          .maybeSingle();
        if (replyTo?.user_id) {
          const { data: replyUser } = await admin
            .from('user_profile')
            .select('nickname')
            .eq('id', replyTo.user_id)
            .maybeSingle();
          replyToNickname = replyUser?.nickname ?? null;
        }
      }

      // ---------- 7. 入库 ----------
      const { data: newComment, error } = await admin
        .from('comments')
        .insert({
          post_id,
          parent_id: parent_id ?? null,
          reply_to_id: reply_to_id ?? null,
          reply_to_nickname: replyToNickname,
          content: safeContent,
          user_id: user.id,
        })
        .select('id, post_id, parent_id, reply_to_id, reply_to_nickname, content, user_id, created_at')
        .single();

      if (error || !newComment) {
        return NextResponse.json(errorResponse(error?.message ?? '评论失败', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      // ---------- 8. 组装返回 ----------
      const result: Comment = {
        id: newComment.id,
        post_id: newComment.post_id,
        parent_id: newComment.parent_id,
        reply_to_id: newComment.reply_to_id,
        reply_to_nickname: newComment.reply_to_nickname,
        content: newComment.content,
        user_id: newComment.user_id,
        user_nickname: user.nickname,
        user_avatar: user.avatar,
        children: [],
        created_at: newComment.created_at,
      };

      return NextResponse.json(successResponse(result, '评论成功'), {
        status: HTTP_STATUS.OK,
      });
    } finally {
      releaseSubmitLock(lockKey);
    }
  } catch (error) {
    console.error('[Comment Add] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
