/**
 * 帖子详情接口
 * - 查询帖子（含作者信息）
 * - 自动 +1 view_count
 * - 根据当前用户权限判定 can_view_link / can_view_code
 * - 无权限时脱敏返回
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import {
  getCurrentUser,
  canViewPublicResource,
  canViewVipResource,
} from '@/lib/auth';
import { maskPanUrl, maskPanCode } from '@/lib/security';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import type { PostDetail, PanLink } from '@/lib/types';

// 禁止缓存，确保增删改后数据立即同步
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(errorResponse('缺少帖子 id', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const supabase = getSupabaseServiceAdmin();

    // ---------- 1. 查询帖子 ----------
    const { data: post, error } = await supabase
      .from('posts')
      .select(
        'id, title, description, cover_url, category, pan_type, pan_url, pan_code, pan_links, is_vip, is_top, hot_weight, status, view_count, comment_count, author_id, created_at, updated_at, points_cost, author:user_profile!posts_author_id_fkey(nickname, avatar)'
      )
      .eq('id', id)
      .single();

    if (error || !post) {
      return NextResponse.json(errorResponse('帖子不存在', 404), {
        status: HTTP_STATUS.NOT_FOUND,
      });
    }

    // ---------- 2. 异步 +1 view_count（service_role 绕过 RLS，避免作者限制）----------
    try {
      const admin = getSupabaseServiceAdmin();
      await admin
        .from('posts')
        .update({ view_count: (post.view_count ?? 0) + 1 })
        .eq('id', id);
    } catch (e) {
      // 阅读量自增失败不影响主流程
      console.warn('[Post Detail] view_count 自增失败', e);
    }

    // ---------- 3. 获取当前用户 ----------
    const user = await getCurrentUser();

    // ---------- 4. 权限判定 ----------
    const isAuthor = !!user && user.id === post.author_id;
    let canViewLink = false;
    let canViewCode = false;
    let isUnlocked = false;
    if (post.is_vip) {
      // VIP 资源
      canViewLink = canViewVipResource(user, post.author_id);
      canViewCode = canViewVipResource(user, post.author_id);
    } else if ((post as any).points_cost > 0) {
      // 积分资源：作者免解锁；其他用户需查询 post_unlock 表
      if (isAuthor) {
        isUnlocked = true;
        canViewLink = true;
        canViewCode = true;
      } else if (user) {
        const admin = getSupabaseServiceAdmin();
        const { data: unlockRow } = await admin
          .from('post_unlock')
          .select('id')
          .eq('user_id', user.id)
          .eq('post_id', id)
          .maybeSingle();
        isUnlocked = !!unlockRow;
        canViewLink = isUnlocked;
        canViewCode = isUnlocked;
      }
    } else {
      // 公开资源
      canViewLink = canViewPublicResource(user);
      canViewCode = canViewPublicResource(user);
    }

    // ---------- 5. 查询是否已收藏 ----------
  let isCollected = false;
  if (user) {
    const { data: collectRow } = await supabase
      .from('collect')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', id)
      .maybeSingle();
    isCollected = !!collectRow;
  }

  // ---------- 6. 组装返回 ----------
    const author = (post as any).author?.[0] ?? (post as any).author ?? {};

    // 构建多链接列表：优先用 pan_links，为 null 时回退到单链接
    const rawPanLinks: PanLink[] =
      (post as any).pan_links && Array.isArray((post as any).pan_links) && (post as any).pan_links.length > 0
        ? (post as any).pan_links
        : [{ type: post.pan_type, url: post.pan_url, code: post.pan_code }];

    // 根据权限脱敏多链接
    const maskedPanLinks: PanLink[] = canViewLink
      ? rawPanLinks
      : rawPanLinks.map((link) => ({
          type: link.type,
          url: maskPanUrl(link.url),
          code: maskPanCode(),
        }));

    const detail: PostDetail = {
      id: post.id,
      title: post.title,
      description: post.description,
      cover_url: post.cover_url,
      category: post.category,
      pan_type: post.pan_type,
      pan_url: canViewLink ? post.pan_url : maskPanUrl(post.pan_url),
      pan_code: canViewCode ? post.pan_code : maskPanCode(),
      pan_links: canViewLink ? rawPanLinks : null,
      is_vip: post.is_vip,
      is_top: post.is_top,
      hot_weight: post.hot_weight,
      status: post.status,
      view_count: (post.view_count ?? 0) + 1,
      comment_count: post.comment_count,
      author_id: post.author_id,
      author_nickname: author.nickname ?? '',
      author_avatar: author.avatar ?? '',
      created_at: post.created_at,
      updated_at: post.updated_at,
      can_view_link: canViewLink,
      can_view_code: canViewCode,
      is_collected: isCollected,
      is_author: isAuthor,
      masked_pan_url: canViewLink ? undefined : maskPanUrl(post.pan_url),
      masked_pan_links: maskedPanLinks,
      points_cost: Number((post as any).points_cost ?? 0),
      is_unlocked: isUnlocked,
    };

    return NextResponse.json(successResponse(detail, '查询成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Post Detail] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
