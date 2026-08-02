/**
 * 后台评论列表接口
 * - 必须管理员
 * - 关联 post_title 与 user_nickname
 * - 支持 post_id 过滤
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  calcPageRange,
  calcTotalPages,
} from '@/lib/utils';
import type { PageResult } from '@/lib/types';

// 后台评论返回结构（含 post_title）
type AdminComment = {
  id: string;
  post_id: string;
  post_title: string;
  parent_id: string | null;
  reply_to_id: string | null;
  reply_to_nickname: string | null;
  content: string;
  user_id: string;
  user_nickname: string;
  user_avatar: string;
  created_at: string;
};

// 禁止缓存，确保增删改后数据立即同步
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    // ---------- 1. 管理员校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!isAdmin(user)) {
      return NextResponse.json(errorResponse('无权访问，仅管理员可访问', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('page_size') ?? '10') || 10));
    const postId = searchParams.get('post_id') ?? undefined;

    // ---------- 2. 构建查询 ----------
    const admin = getSupabaseServiceAdmin();
    let query = admin
      .from('comments')
      .select(
        'id, post_id, parent_id, reply_to_id, reply_to_nickname, content, user_id, created_at, post:posts!comments_post_id_fkey(title), user:user_profile!comments_user_id_fkey(nickname, avatar)',
        { count: 'exact' }
      );

    if (postId) {
      query = query.eq('post_id', postId);
    }

    const { from, to } = calcPageRange(page, pageSize);
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const total = count ?? 0;

    // ---------- 3. 整理返回结构 ----------
    const list: AdminComment[] = (data ?? []).map((item: any) => {
      const post = item.post?.[0] ?? item.post ?? {};
      const u = item.user?.[0] ?? item.user ?? {};
      return {
        id: item.id,
        post_id: item.post_id,
        post_title: post.title ?? '',
        parent_id: item.parent_id,
        reply_to_id: item.reply_to_id,
        reply_to_nickname: item.reply_to_nickname,
        content: item.content,
        user_id: item.user_id,
        user_nickname: u.nickname ?? '',
        user_avatar: u.avatar ?? '',
        created_at: item.created_at,
      };
    });

    const result: PageResult<AdminComment> = {
      list,
      total,
      page,
      page_size: pageSize,
      total_pages: calcTotalPages(total, pageSize),
    };

    return NextResponse.json(successResponse(result, '查询成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Admin Comments] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
