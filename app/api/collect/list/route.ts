/**
 * 我的收藏列表接口
 * - 必须登录
 * - 关联 posts 取 title / cover_url / category
 * - 返回 PageResult<Collect>
 */
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  calcPageRange,
  calcTotalPages,
} from '@/lib/utils';
import type { Collect, PageResult } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const pageSize = Math.max(1, Math.min(50, Number(searchParams.get('page_size') ?? '10') || 10));

    // ---------- 1. 登录校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    const supabase = await getSupabaseServer();

    // ---------- 2. 查询收藏列表 ----------
    const { from, to } = calcPageRange(page, pageSize);
    const { data, error, count } = await supabase
      .from('collect')
      .select(
        'id, user_id, post_id, created_at, post:posts!collect_post_id_fkey(title, cover_url, category)',
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const total = count ?? 0;

    // ---------- 3. 整理返回结构 ----------
    const list: Collect[] = (data ?? []).map((item: any) => {
      const post = item.post?.[0] ?? item.post ?? {};
      return {
        id: item.id,
        user_id: item.user_id,
        post_id: item.post_id,
        post_title: post.title ?? '',
        post_cover_url: post.cover_url ?? '',
        post_category: post.category ?? 'software',
        created_at: item.created_at,
      } as Collect;
    });

    const result: PageResult<Collect> = {
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
    console.error('[Collect List] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
