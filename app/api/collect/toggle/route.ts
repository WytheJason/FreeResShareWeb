/**
 * 收藏 / 取消收藏 接口
 * - 必须登录
 * - 已存在 → delete；不存在 → insert
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { post_id } = body as { post_id: string };

    // ---------- 1. 登录校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!post_id) {
      return NextResponse.json(errorResponse('缺少 post_id', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // ---------- 2. 查询是否已收藏 ----------
    const { data: existing } = await admin
      .from('collect')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', post_id)
      .maybeSingle();

    if (existing) {
      // ---------- 已存在 → 取消收藏 ----------
      const { error } = await admin
        .from('collect')
        .delete()
        .eq('id', existing.id);
      if (error) {
        return NextResponse.json(errorResponse(error.message, 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      return NextResponse.json(
        successResponse({ collected: false }, '已取消收藏'),
        { status: HTTP_STATUS.OK }
      );
    }

    // ---------- 不存在 → 新增收藏 ----------
    const { error } = await admin.from('collect').insert({
      user_id: user.id,
      post_id,
    });
    if (error) {
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    return NextResponse.json(
      successResponse({ collected: true }, '已收藏'),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[Collect Toggle] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
