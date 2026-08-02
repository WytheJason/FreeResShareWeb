/**
 * 浏览记录列表接口
 * - 必须登录
 * - 简化实现：浏览记录功能依赖客户端 localStorage 上报，此处返回推荐数据
 * - 实际查询：posts 表 status=normal，order by view_count desc，limit page_size
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  calcPageRange,
  calcTotalPages,
} from '@/lib/utils';
import { maskPanUrl, maskPanCode } from '@/lib/security';
import type { Post, PageResult } from '@/lib/types';

// 禁止缓存，确保增删改后数据立即同步
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const pageSize = Math.max(1, Math.min(50, Number(searchParams.get('page_size') ?? '20') || 20));

    // ---------- 1. 登录校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    const supabase = getSupabaseServiceAdmin();

    // ---------- 2. 查询热门帖子（推荐数据）----------
    // 说明：浏览记录功能依赖客户端 localStorage 上报，本接口暂以"按 view_count 倒序"返回推荐数据
    const { from, to } = calcPageRange(page, pageSize);
    const { data, error, count } = await supabase
      .from('posts')
      .select(
        'id, title, description, cover_url, category, pan_type, pan_url, pan_code, is_vip, is_top, hot_weight, status, view_count, comment_count, author_id, created_at, updated_at, author:user_profile!posts_author_id_fkey(nickname, avatar)',
        { count: 'exact' }
      )
      .eq('status', 'normal')
      .order('view_count', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const total = count ?? 0;

    // ---------- 3. 整理返回结构（脱敏链接与提取码）----------
    const list: Post[] = (data ?? []).map((item: any) => {
      const author = item.author?.[0] ?? item.author ?? {};
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        cover_url: item.cover_url,
        category: item.category,
        pan_type: item.pan_type,
        pan_url: maskPanUrl(item.pan_url),
        pan_code: maskPanCode(),
        is_vip: item.is_vip,
        is_top: item.is_top,
        hot_weight: item.hot_weight,
        status: item.status,
        view_count: item.view_count,
        comment_count: item.comment_count,
        author_id: item.author_id,
        author_nickname: author.nickname ?? '',
        author_avatar: author.avatar ?? '',
        created_at: item.created_at,
        updated_at: item.updated_at,
      } as Post;
    });

    const result: PageResult<Post> = {
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
    console.error('[History List] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
