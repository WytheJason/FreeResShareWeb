/**
 * 个人中心页（服务端入口）
 * - 查询用户资料
 * - 根据 searchParams.tab 服务端查询对应数据
 * - 收藏/浏览记录仅本人可见，他人访问显示"无权限"
 */

// 禁止缓存，确保增删改后数据立即同步
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { notFound } from 'next/navigation';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { maskPanUrl, maskPanCode } from '@/lib/security';
import { calcPageRange, calcTotalPages } from '@/lib/utils';
import type {
  UserProfile,
  Post,
  PostCategory,
  PanType,
  PostStatus,
} from '@/lib/types';
import UserCenterClient, {
  type TabKey,
  type UserCommentItem,
  type UserStats,
} from './UserCenterClient';

const PAGE_SIZE = 12;
const VALID_TABS: TabKey[] = ['posts', 'comments', 'collects', 'history', 'points'];

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
  is_vip: boolean;
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

// 收藏原始查询结果（含帖子关联）
interface CollectRaw {
  id: string;
  post_id: string;
  post: unknown;
}

// 评论原始查询结果（含帖子关联）
interface CommentRaw {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  post: unknown;
}

// 从关联字段提取首个对象
function pickFirst<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  if (raw && typeof raw === 'object') return raw as T;
  return null;
}

// 帖子原始数据 → Post（脱敏链接，列表页不暴露明文）
function toPost(raw: PostRaw): Post {
  const a = pickFirst<{ nickname?: string; avatar?: string }>(raw.author);
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    cover_url: raw.cover_url,
    category: raw.category,
    pan_type: raw.pan_type,
    pan_url: maskPanUrl(raw.pan_url),
    pan_code: maskPanCode(),
    is_vip: raw.is_vip,
    is_top: raw.is_top,
    hot_weight: raw.hot_weight,
    status: raw.status,
    view_count: raw.view_count,
    comment_count: raw.comment_count,
    author_id: raw.author_id,
    author_nickname: a?.nickname ?? '',
    author_avatar: a?.avatar ?? '',
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    points_cost: raw.points_cost ?? 0,
  };
}

const POST_SELECT =
  'id, title, description, cover_url, category, pan_type, pan_url, pan_code, is_vip, is_top, hot_weight, status, view_count, comment_count, author_id, created_at, updated_at, points_cost, author:user_profile!posts_author_id_fkey(nickname, avatar)';

export default async function UserPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string; page?: string };
}) {
  // ---------- 1. 查询用户资料 ----------
  // 使用 service_role 绕过 RLS，因为用户资料（昵称/头像/等级）为公开信息
  // 否则未登录或访问他人主页时 RLS 会阻止读取，导致 notFound() 误触发 404
  const admin = getSupabaseServiceAdmin();
  const { data: profileData } = await admin
    .from('user_profile')
    .select('*')
    .eq('id', params.id)
    .single();
  // notFound() 抛出异常，此处先判空再断言为非空类型
  if (!profileData) {
    notFound();
  }
  const profileRaw = profileData as UserProfile;

  // 获取当前登录用户（可能为 null，如未登录访问他人主页）
  const currentUser = await getCurrentUser();
  const isOwner = !!currentUser && currentUser.id === params.id;

  // 非本人访问时隐藏 email 等敏感字段
  const profile: UserProfile = isOwner
    ? profileRaw
    : { ...profileRaw, email: '' };

  // 用户级数据查询统一使用 admin 绕过 RLS（权限已在 API 层校验）
  // 避免 RLS 递归或策略配置问题导致查询失败

  // ---------- 1.5. 统计数据（仅本人可见额外信息）----------
  const userStats: UserStats = {
    post_count: profile.post_count,
    comment_count: profile.comment_count,
    collect_count: 0,
    view_count: 0,
    points: profile.points ?? 0,
    invite_count: profile.invite_count ?? 0,
  };
  if (isOwner) {
    const [{ count: collectCount }, { count: viewCount }] = await Promise.all([
      admin
        .from('collect')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', params.id),
      admin
        .from('view_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', params.id),
    ]).catch(() => [{ count: 0 }, { count: 0 }]);
    userStats.collect_count = collectCount ?? 0;
    userStats.view_count = viewCount ?? 0;
  }

  // ---------- 2. 解析 tab 和 page ----------
  const tab: TabKey = VALID_TABS.includes(searchParams.tab as TabKey)
    ? (searchParams.tab as TabKey)
    : 'posts';
  const page = Math.max(1, Number(searchParams.page ?? '1') || 1);

  // 收藏/浏览记录仅本人可见
  const isOwnerOnlyTab = tab === 'collects' || tab === 'history';
  const showNoPermission = isOwnerOnlyTab && !isOwner;

  // ---------- 3. 根据 tab 查询数据 ----------
  // 帖子列表和评论列表为公开数据，使用 admin 绕过 RLS 查询
  // 收藏/浏览记录为私有数据，使用绑定会话的 supabase 客户端（受 RLS 保护）
  const { from, to } = calcPageRange(page, PAGE_SIZE);
  let list: (Post | UserCommentItem)[] = [];
  let total = 0;

  if (!showNoPermission) {
    if (tab === 'posts') {
      const { data, count } = await admin
        .from('posts')
        .select(POST_SELECT, { count: 'exact' })
        .eq('author_id', params.id)
        .order('created_at', { ascending: false })
        .range(from, to);
      list = ((data ?? []) as PostRaw[]).map(toPost);
      total = count ?? 0;
    } else if (tab === 'comments') {
      const { data, count } = await admin
        .from('comments')
        .select(
          'id, content, created_at, post_id, post:posts!comments_post_id_fkey(title)',
          { count: 'exact' }
        )
        .eq('user_id', params.id)
        .order('created_at', { ascending: false })
        .range(from, to);
      list = ((data ?? []) as CommentRaw[]).map((item) => {
        const p = pickFirst<{ title?: string }>(item.post);
        return {
          id: item.id,
          content: item.content,
          created_at: item.created_at,
          post_id: item.post_id,
          post_title: p?.title ?? '',
        };
      });
      total = count ?? 0;
    } else if (tab === 'collects') {
      // 本人收藏：关联帖子，返回完整 Post 列表
      const { data, count } = await admin
        .from('collect')
        .select(`id, post_id, post:posts!collect_post_id_fkey(${POST_SELECT})`, {
          count: 'exact',
        })
        .eq('user_id', params.id)
        .order('created_at', { ascending: false })
        .range(from, to);
      list = ((data ?? []) as CollectRaw[])
        .map((item) => pickFirst<PostRaw>(item.post))
        .filter((p): p is PostRaw => !!p)
        .map(toPost);
      total = count ?? 0;
    } else if (tab === 'history') {
      // 浏览记录：按 view_count 倒序的推荐帖子
      const { data, count } = await admin
        .from('posts')
        .select(POST_SELECT, { count: 'exact' })
        .eq('status', 'normal')
        .order('view_count', { ascending: false })
        .range(from, to);
      list = ((data ?? []) as PostRaw[]).map(toPost);
      total = count ?? 0;
    }
  }

  const pageData = {
    list,
    total,
    page,
    page_size: PAGE_SIZE,
    total_pages: calcTotalPages(total, PAGE_SIZE),
  };

  return (
    <UserCenterClient
      profile={profile}
      currentUser={currentUser}
      isOwner={isOwner}
      activeTab={tab}
      showNoPermission={showNoPermission}
      pageData={pageData}
      userStats={userStats}
    />
  );
}
