/**
 * 后台帖子列表接口
 * - 必须管理员
 * - 不过滤 status（可看到 hidden / pending 帖子）
 * - 支持 status、category 过滤
 * - 返回 PageResult<Post>
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
import type { Post, PageResult, PostStatus, PostCategory } from '@/lib/types';

const STATUS_SET: PostStatus[] = ['normal', 'pending', 'hidden'];
const CATEGORY_SET: PostCategory[] = ['software', 'movie'];

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
    const pageSize = Math.max(1, Math.min(50, Number(searchParams.get('page_size') ?? '10') || 10));
    const status = searchParams.get('status') ?? undefined;
    const category = searchParams.get('category') ?? undefined;

    // ---------- 2. 构建查询（service_role，绕过 RLS）----------
    const admin = getSupabaseServiceAdmin();
    let query = admin
      .from('posts')
      .select(
        'id, title, description, cover_url, category, pan_type, pan_url, pan_code, is_vip, is_top, hot_weight, status, view_count, comment_count, author_id, created_at, updated_at, author:user_profile!posts_author_id_fkey(nickname, avatar)',
        { count: 'exact' }
      );

    if (status && STATUS_SET.includes(status as PostStatus)) {
      query = query.eq('status', status);
    }
    if (category && CATEGORY_SET.includes(category as PostCategory)) {
      query = query.eq('category', category);
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

    // ---------- 3. 整理返回结构（管理后台可见完整 pan_url）----------
    const list: Post[] = (data ?? []).map((item: any) => {
      const author = item.author?.[0] ?? item.author ?? {};
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        cover_url: item.cover_url,
        category: item.category,
        pan_type: item.pan_type,
        pan_url: item.pan_url,
        pan_code: item.pan_code,
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
    console.error('[Admin Posts] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
