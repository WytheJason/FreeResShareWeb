/**
 * 帖子详情页（服务端入口）
 * - 直接查询帖子详情（不走 HTTP API）
 * - +1 view_count（service_role 绕过 RLS）
 * - 计算权限 can_view_link / can_view_code / is_collected / is_author
 * - 查询第一页评论（嵌套结构）
 */

// 禁止缓存，确保增删改后数据立即同步
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { notFound } from 'next/navigation';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import {
  getCurrentUser,
  canViewPublicResource,
  canViewVipResource,
} from '@/lib/auth';
import { maskPanUrl, maskPanCode } from '@/lib/security';
import { calcPageRange, calcTotalPages } from '@/lib/utils';
import type {
  PostDetail,
  Comment,
  PageResult,
  PostCategory,
  PanType,
  PanLink,
  PostStatus,
  UserProfile,
} from '@/lib/types';
import PostDetailClient from './PostDetailClient';

// 帖子原始查询结果（含作者关联）
interface PostRaw {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  category: PostCategory;
  pan_type: PanType;
  pan_url: string;
  pan_code: string;
  pan_links: PanLink[] | null;
  is_vip: boolean;
  need_login?: boolean;
  is_top: boolean;
  hot_weight: number;
  status: PostStatus;
  view_count: number;
  comment_count: number;
  author_id: string;
  created_at: string;
  updated_at: string;
  points_cost: number;
  author: unknown;
}

// 评论原始查询结果（含用户关联）
interface CommentRaw {
  id: string;
  post_id: string;
  parent_id: string | null;
  reply_to_id: string | null;
  reply_to_nickname: string | null;
  content: string;
  user_id: string;
  created_at: string;
  user: unknown;
}

// 从关联字段中提取首个对象（兼容数组/对象两种返回形式）
function pickFirst<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  if (raw && typeof raw === 'object') return raw as T;
  return null;
}

// 构建评论嵌套结构（parent_id 关联）
function buildCommentTree(list: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  list.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: Comment[] = [];
  map.forEach((c) => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children!.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

export default async function PostDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // 使用 admin 绕过 RLS 查询帖子详情和收藏状态（公开数据 + 私有数据均通过 admin 查询）
  const admin = getSupabaseServiceAdmin();

  // ---------- 1. 查询帖子 ----------
  const { data: rawData, error } = await admin
    .from('posts')
    .select(
      'id, title, description, cover_url, category, pan_type, pan_url, pan_code, pan_links, is_vip, is_top, hot_weight, status, view_count, comment_count, author_id, created_at, updated_at, points_cost, author:user_profile!posts_author_id_fkey(nickname, avatar)'
    )
    .eq('id', params.id)
    .single();

  // notFound() 抛出异常，此处先判空再断言为非空类型，避免 TS 收窄失效
  if (error || !rawData) {
    notFound();
  }
  const raw = rawData as PostRaw;

  // ---------- 2. +1 view_count ----------
  try {
    await admin
      .from('posts')
      .update({ view_count: (raw.view_count ?? 0) + 1 })
      .eq('id', params.id);
  } catch (e) {
    console.warn('[Post Page] view_count 自增失败', e);
  }

  // ---------- 3. 当前用户 + 权限判定 ----------
  const currentUser: UserProfile | null = await getCurrentUser();
  const isAuthor = !!currentUser && currentUser.id === raw.author_id;
  let canViewLink = false;
  let canViewCode = false;
  let isUnlocked = false;

  // 积分资源（points_cost > 0）：需要积分解锁后才能查看
  // VIP 资源（is_vip=true）：VIP 会员或作者可查看
  // 需登录资源（need_login=true）：登录用户可查看
  // 公开资源（need_login=false）：任何人可查看
  const needLogin = (raw as any).need_login !== false;
  if (raw.points_cost > 0) {
    // 作者无需解锁
    if (isAuthor) {
      canViewLink = true;
      canViewCode = true;
      isUnlocked = true;
    } else if (currentUser) {
      // 检查是否已解锁
      const { data: unlockRow } = await admin
        .from('post_unlock')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('post_id', params.id)
        .maybeSingle();
      isUnlocked = !!unlockRow;
      canViewLink = isUnlocked;
      canViewCode = isUnlocked;
    }
  } else if (raw.is_vip) {
    canViewLink = canViewVipResource(currentUser, raw.author_id);
    canViewCode = canViewVipResource(currentUser, raw.author_id);
  } else if (!needLogin) {
    // 公开资源：任何人可查看
    canViewLink = true;
    canViewCode = true;
  } else {
    // 需登录资源：登录用户可查看
    canViewLink = canViewPublicResource(currentUser);
    canViewCode = canViewPublicResource(currentUser);
  }

  // ---------- 4. 是否已收藏 ----------
  let isCollected = false;
  if (currentUser) {
    const { data: collectRow } = await admin
      .from('collect')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('post_id', params.id)
      .maybeSingle();
    isCollected = !!collectRow;
  }

  // ---------- 5. 组装 PostDetail ----------
  const author = pickFirst<{ nickname?: string; avatar?: string }>(raw.author);

  // 构建多链接列表：优先用 pan_links，为 null 时回退到单链接
  const allPanLinks: PanLink[] =
    raw.pan_links && Array.isArray(raw.pan_links) && raw.pan_links.length > 0
      ? raw.pan_links
      : [{ type: raw.pan_type, url: raw.pan_url, code: raw.pan_code }];

  // 根据权限脱敏多链接
  const maskedPanLinks: PanLink[] = canViewLink
    ? allPanLinks
    : allPanLinks.map((link) => ({
        type: link.type,
        url: maskPanUrl(link.url),
        code: maskPanCode(),
      }));

  const post: PostDetail = {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    cover_url: raw.cover_url,
    category: raw.category,
    pan_type: raw.pan_type,
    pan_url: canViewLink ? raw.pan_url : maskPanUrl(raw.pan_url),
    pan_code: canViewCode ? raw.pan_code : maskPanCode(),
    pan_links: canViewLink ? allPanLinks : null,
    is_vip: raw.is_vip,
    is_top: raw.is_top,
    hot_weight: raw.hot_weight,
    status: raw.status,
    view_count: (raw.view_count ?? 0) + 1,
    comment_count: raw.comment_count,
    author_id: raw.author_id,
    author_nickname: author?.nickname ?? '',
    author_avatar: author?.avatar ?? '',
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    points_cost: raw.points_cost ?? 0,
    can_view_link: canViewLink,
    can_view_code: canViewCode,
    is_collected: isCollected,
    is_author: isAuthor,
    is_unlocked: isUnlocked,
    masked_pan_url: canViewLink ? undefined : maskPanUrl(raw.pan_url),
    masked_pan_links: maskedPanLinks,
  };

  // ---------- 6. 查询第一页评论（构建嵌套后内存分页根评论）----------
  // 使用 admin 绕过 RLS，评论为公开数据
  const pageSize = 20;
  const { data: rawComments } = await admin
    .from('comments')
    .select(
      'id, post_id, parent_id, reply_to_id, reply_to_nickname, content, user_id, created_at, user:user_profile!comments_user_id_fkey(nickname, avatar)'
    )
    .eq('post_id', params.id)
    .order('created_at', { ascending: true });
  const rawList = (rawComments ?? []) as CommentRaw[];

  const allComments: Comment[] = rawList.map((item) => {
    const u = pickFirst<{ nickname?: string; avatar?: string }>(item.user);
    return {
      id: item.id,
      post_id: item.post_id,
      parent_id: item.parent_id,
      reply_to_id: item.reply_to_id,
      reply_to_nickname: item.reply_to_nickname,
      content: item.content,
      user_id: item.user_id,
      user_nickname: u?.nickname ?? '',
      user_avatar: u?.avatar ?? '',
      children: [],
      created_at: item.created_at,
    };
  });

  const roots = buildCommentTree(allComments);
  const { from, to } = calcPageRange(1, pageSize);
  const pagedRoots = roots.slice(from, to + 1);
  const total = roots.length;
  const comments: PageResult<Comment> = {
    list: pagedRoots,
    total,
    page: 1,
    page_size: pageSize,
    total_pages: calcTotalPages(total, pageSize),
  };

  return <PostDetailClient post={post} comments={comments} currentUser={currentUser} />;
}
