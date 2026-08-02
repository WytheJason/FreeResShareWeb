/**
 * 删除帖子接口
 * - 必须登录
 * - 必须是作者或管理员
 * - 数据库设置 on delete cascade 级联删除评论/收藏/举报
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
      return NextResponse.json(errorResponse('缺少帖子 id', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // ---------- 2. 查询帖子校验权限 ----------
    const { data: post, error: queryError } = await admin
      .from('posts')
      .select('id, author_id')
      .eq('id', id)
      .single();

    if (queryError || !post) {
      return NextResponse.json(errorResponse('帖子不存在', 404), {
        status: HTTP_STATUS.NOT_FOUND,
      });
    }

    const isAuthor = post.author_id === user.id;
    if (!isAuthor && !isAdmin(user)) {
      return NextResponse.json(errorResponse('无权删除该帖子', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // ---------- 3. 执行删除（级联由数据库处理）----------
    const { error: deleteError } = await admin
      .from('posts')
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
    console.error('[Post Delete] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
