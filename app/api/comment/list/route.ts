/**
 * 评论分页查询接口
 * - 关联 user_profile 取 nickname/avatar
 * - 按 created_at asc 排序
 * - 服务端构建嵌套结构（parent_id 关联）
 * - 返回 PageResult<Comment>（list 为根评论，每个含 children）
 */
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  calcPageRange,
  calcTotalPages,
} from '@/lib/utils';
import type { Comment, PageResult } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('post_id');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('page_size') ?? '10') || 10));

    if (!postId) {
      return NextResponse.json(errorResponse('缺少 post_id', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const supabase = await getSupabaseServer();

    // ---------- 1. 查询所有评论（按 created_at asc，便于构建嵌套）----------
    // 这里采用查询全量后服务端构建嵌套 + 内存分页返回根评论的方式
    // 评论量通常不会过大（< 1000），可以接受
    const { data: allComments, error } = await supabase
      .from('comments')
      .select(
        'id, post_id, parent_id, reply_to_id, reply_to_nickname, content, user_id, created_at, user:user_profile!comments_user_id_fkey(nickname, avatar)'
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // ---------- 2. 整理评论结构 ----------
    const allList: Comment[] = (allComments ?? []).map((item: any) => {
      const u = item.user?.[0] ?? item.user ?? {};
      return {
        id: item.id,
        post_id: item.post_id,
        parent_id: item.parent_id,
        reply_to_id: item.reply_to_id,
        reply_to_nickname: item.reply_to_nickname,
        content: item.content,
        user_id: item.user_id,
        user_nickname: u.nickname ?? '',
        user_avatar: u.avatar ?? '',
        children: [],
        created_at: item.created_at,
      };
    });

    // ---------- 3. 构建嵌套（用 Map 索引）----------
    const map = new Map<string, Comment>();
    allList.forEach((c) => map.set(c.id, { ...c, children: [] }));

    const roots: Comment[] = [];
    map.forEach((c) => {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.children!.push(c);
      } else {
        roots.push(c);
      }
    });

    // ---------- 4. 内存分页根评论（total 以根评论数为准）----------
    const { from, to } = calcPageRange(page, pageSize);
    const pagedRoots = roots.slice(from, to + 1);
    const total = roots.length;

    const result: PageResult<Comment> = {
      list: pagedRoots,
      total,
      page,
      page_size: pageSize,
      total_pages: calcTotalPages(total, pageSize),
    };

    return NextResponse.json(successResponse(result, '查询成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Comment List] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
