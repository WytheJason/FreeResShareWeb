/**
 * 提交举报接口
 * - 必须登录
 * - 防抖锁（10 秒）
 * - 检查帖子存在
 * - 同一用户对同一帖子的 pending 举报只允许一个
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import {
  sanitizeUserContent,
  acquireSubmitLock,
  releaseSubmitLock,
  buildLockKey,
} from '@/lib/security';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { post_id, reason } = body as { post_id: string; reason: string };

    // ---------- 1. 登录校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    // ---------- 2. 防抖锁（10 秒）----------
    const lockKey = buildLockKey(user.id, 'report');
    if (!acquireSubmitLock(lockKey, 10000)) {
      return NextResponse.json(errorResponse('提交过于频繁，请稍后重试', 429), {
        status: HTTP_STATUS.TOO_MANY_REQUESTS,
      });
    }

    try {
      // ---------- 3. 参数校验 ----------
      if (!post_id) {
        return NextResponse.json(errorResponse('缺少 post_id', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      const reasonTrim = (reason ?? '').trim();
      if (!reasonTrim || reasonTrim.length > 500) {
        return NextResponse.json(errorResponse('举报理由需在 1-500 字之间', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      const safeReason = sanitizeUserContent(reasonTrim);

      const admin = getSupabaseServiceAdmin();

      // ---------- 4. 检查帖子存在 ----------
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

      // ---------- 5. 同一用户对同一帖子 pending 举报唯一 ----------
      const { data: existing } = await admin
        .from('report')
        .select('id')
        .eq('post_id', post_id)
        .eq('reporter_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        return NextResponse.json(errorResponse('您已提交过该帖子的举报，正在处理中', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      // ---------- 6. 写入举报 ----------
      const { error } = await admin.from('report').insert({
        post_id,
        reporter_id: user.id,
        reason: safeReason,
        status: 'pending',
      });

      if (error) {
        return NextResponse.json(errorResponse(error.message, 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      return NextResponse.json(successResponse(null, '举报已提交'), {
        status: HTTP_STATUS.OK,
      });
    } finally {
      releaseSubmitLock(lockKey);
    }
  } catch (error) {
    console.error('[Report Submit] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
