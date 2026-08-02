/**
 * 删除评论接口
 * - 必须登录
 * - 必须是评论作者或管理员
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id } = body as { id: string };

    // ---------- 1. 登录校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!id) {
      return NextResponse.json(errorResponse('缺少评论 id', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // ---------- 2. 查询评论校验权限 ----------
    const { data: comment, error: queryError } = await admin
      .from('comments')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (queryError || !comment) {
      return NextResponse.json(errorResponse('评论不存在', 404), {
        status: HTTP_STATUS.NOT_FOUND,
      });
    }

    const isAuthor = comment.user_id === user.id;
    if (!isAuthor && !isAdmin(user)) {
      return NextResponse.json(errorResponse('无权删除该评论', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // ---------- 3. 执行删除 ----------
    const { error: deleteError } = await admin
      .from('comments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(errorResponse(deleteError.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    return NextResponse.json(successResponse(null, '删除成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Comment Delete] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
