/**
 * 帖子分页查询接口
 * - 仅返回 status='normal' 的帖子
 * - 支持分类、关键词、排序、VIP 过滤
 * - 列表不返回完整 pan_url / pan_code（脱敏）
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
import { maskPanUrl, maskPanCode } from '@/lib/security';
import type { Post, PageResult, PostCategory } from '@/lib/types';

// 合法分类白名单
const CATEGORY_SET: PostCategory[] = ['software', 'movie'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const pageSize = Math.max(1, Math.min(50, Number(searchParams.get('page_size') ?? '10') || 10));
    const category = searchParams.get('category') ?? undefined;
    const keyword = searchParams.get('keyword') ?? undefined;
    const sort = searchParams.get('sort') ?? 'latest';
    const isVipParam = searchParams.get('is_vip');

    const supabase = await getSupabaseServer();

    // ---------- 构建查询 ----------
    let query = supabase
      .from('posts')
      .select(
        'id, title, description, cover_url, category, pan_type, pan_url, pan_code, is_vip, is_top, hot_weight, status, view_count, comment_count, author_id, created_at, updated_at, author:user_profile!posts_author_id_fkey(nickname, avatar)',
        { count: 'exact' }
      )
      .eq('status', 'normal');

    // 分类过滤
    if (category && CATEGORY_SET.includes(category as PostCategory)) {
      query = query.eq('category', category);
    }

    // VIP 过滤
    if (isVipParam === 'true' || isVipParam === '1') {
      query = query.eq('is_vip', true);
    } else if (isVipParam === 'false' || isVipParam === '0') {
      query = query.eq('is_vip', false);
    }

    // 关键词模糊搜索（转义 % _ \）
    if (keyword) {
      const escaped = keyword.replace(/[%_\\]/g, '\\$&');
      query = query.ilike('title', `%${escaped}%`);
    }

    // 排序
    if (sort === 'hot') {
      // 热度排序：hot_weight*10 + view_count + comment_count*5
      query = query.order('hot_weight', { ascending: false }).order('view_count', { ascending: false }).order('comment_count', { ascending: false });
    } else if (sort === 'top') {
      // 置顶帖优先，再按创建时间倒序
      query = query.order('is_top', { ascending: false }).order('created_at', { ascending: false });
    } else {
      // 默认最新
      query = query.order('created_at', { ascending: false });
    }

    // 分页
    const { from, to } = calcPageRange(page, pageSize);
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const total = count ?? 0;

    // ---------- 整理返回结构 + 脱敏 ----------
    const list: Post[] = (data ?? []).map((item: any) => {
      const author = item.author?.[0] ?? item.author ?? {};
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        cover_url: item.cover_url,
        category: item.category,
        pan_type: item.pan_type,
        // 列表页对链接与提取码脱敏
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
    console.error('[Post List] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
