/**
 * 首页（服务端组件）
 * - Hero 区：渐变背景 + 大标题 + 搜索框 + 分类筛选
 * - 三大分区：置顶 / 最新 / 热门（默认视图）
 * - 搜索/筛选/分页视图：单一列表 + 分页（URL 驱动）
 * 数据通过 getSupabaseServer() 直连数据库查询，避免 HTTP 自调用
 */
import Link from 'next/link';
import { Pin, Clock, Flame, ArrowRight, Sparkles } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase-server';
import { maskPanUrl, maskPanCode } from '@/lib/security';
import { calcPageRange, calcTotalPages } from '@/lib/utils';
import type {
  Post,
  PostCategory,
  PostStatus,
  PanType,
  PageResult,
} from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import PostCard from '@/components/PostCard';
import Empty from '@/components/Empty';
import SearchBox from '@/components/SearchBox';
import PaginationLink from '@/components/PaginationLink';

// 最新分区每页条数
const LATEST_PAGE_SIZE = 12;
// 搜索/筛选视图每页条数
const SEARCH_PAGE_SIZE = 12;
// 置顶与热门展示数量
const TOP_LIMIT = 6;
const HOT_LIMIT = 6;

// 查询排序类型
type SortType = 'latest' | 'hot' | 'top';

// 帖子表关联查询的原始行类型（author 关联 user_profile）
interface PostRow {
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
  author: { nickname: string; avatar: string }[] | { nickname: string; avatar: string } | null;
}

// ============ 查询参数与查询函数 ============

interface QueryOptions {
  page: number;
  pageSize: number;
  category?: PostCategory;
  keyword?: string;
  sort?: SortType;
}

/**
 * 查询帖子分页数据（与 /api/post/list 逻辑一致，但直接读 DB）
 * 列表数据对网盘链接与提取码进行脱敏
 */
async function queryPosts(opts: QueryOptions): Promise<PageResult<Post>> {
  const { page, pageSize, category, keyword, sort = 'latest' } = opts;

  let data: PostRow[] | null = null;
  let count: number | null = null;

  try {
    const supabase = await getSupabaseServer();
    let query = supabase
      .from('posts')
      .select(
        'id, title, description, cover_url, category, pan_type, pan_url, pan_code, is_vip, is_top, hot_weight, status, view_count, comment_count, author_id, created_at, updated_at, author:user_profile!posts_author_id_fkey(nickname, avatar)',
        { count: 'exact' }
      )
      .eq('status', 'normal');

    // 分类过滤
    if (category) {
      query = query.eq('category', category);
    }

    // 关键词模糊搜索（转义 % _ \）
    if (keyword) {
      const escaped = keyword.replace(/[%_\\]/g, '\\$&');
      query = query.ilike('title', `%${escaped}%`);
    }

    // 排序
    if (sort === 'hot') {
      query = query
        .order('hot_weight', { ascending: false })
        .order('view_count', { ascending: false })
        .order('comment_count', { ascending: false });
    } else if (sort === 'top') {
      query = query
        .order('is_top', { ascending: false })
        .order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // 分页
    const { from, to } = calcPageRange(page, pageSize);
    query = query.range(from, to);

    const res = await query;
    if (res.error) {
      // Supabase 返回错误（表未建/RLS/网络）时优雅降级
      console.error('[HomePage] query error:', res.error.message);
      data = null;
      count = null;
    } else {
      data = res.data as unknown as PostRow[] | null;
      count = res.count;
    }
  } catch (e) {
    // 数据库连接异常（网络/环境变量缺失）时优雅降级，返回空列表
    console.error('[HomePage] DB exception:', e);
    data = null;
    count = null;
  }
  const total = count ?? 0;

  const list: Post[] = ((data ?? []) as unknown as PostRow[]).map((item) => {
    const authorRaw = item.author;
    const author: { nickname?: string; avatar?: string } = Array.isArray(authorRaw)
      ? authorRaw[0] ?? {}
      : authorRaw ?? {};
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
    };
  });

  return {
    list,
    total,
    page,
    page_size: pageSize,
    total_pages: calcTotalPages(total, pageSize),
  };
}

// ============ searchParams 解析 ============

type SearchParams = { [key: string]: string | string[] | undefined };

function parseString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseCategory(value: string | string[] | undefined): PostCategory | undefined {
  const v = parseString(value);
  if (v === 'software' || v === 'movie') return v;
  return undefined;
}

function parseSort(value: string | string[] | undefined): SortType | undefined {
  const v = parseString(value);
  if (v === 'latest' || v === 'hot' || v === 'top') return v;
  return undefined;
}

function parsePage(value: string | string[] | undefined): number {
  const v = parseString(value);
  const n = parseInt(v ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * 把 searchParams 对象重建为查询字符串（用于客户端组件保留参数）
 */
function buildSearchString(sp: SearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    }
  }
  return params.toString();
}

// ============ 子组件：分区标题 ============

interface SectionHeaderProps {
  icon: React.ReactNode;
  iconWrapCls: string;
  title: string;
  moreHref?: string;
}

function SectionHeader({ icon, iconWrapCls, title, moreHref }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${iconWrapCls}`}>
          {icon}
        </span>
        <h2 className="section-title text-lg">{title}</h2>
      </div>
      {moreHref && (
        <Link
          href={moreHref}
          className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-primary-300"
        >
          查看更多
          <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

// ============ 子组件：帖子卡片网格 ============

function PostGrid({ posts }: { posts: Post[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

// ============ 主页面 ============

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // 解析 URL 参数
  const keyword = parseString(searchParams.keyword) ?? '';
  const category = parseCategory(searchParams.category);
  const sort = parseSort(searchParams.sort);
  const page = parsePage(searchParams.page);

  // 是否进入"列表视图"（搜索/筛选/排序/分页）
  const isListView =
    !!keyword || !!category || !!sort || page > 1;

  const currentSearch = buildSearchString(searchParams);

  // ---------- 列表视图：单一查询 + 分页 ----------
  if (isListView) {
    const result = await queryPosts({
      page,
      pageSize: SEARCH_PAGE_SIZE,
      category,
      keyword: keyword || undefined,
      sort: sort ?? 'latest',
    });

    // 视图标题
    let viewTitle = '全部资源';
    if (keyword) viewTitle = `搜索 "${keyword}" 的结果`;
    else if (category) viewTitle = CATEGORY_LABELS[category];
    else if (sort === 'top') viewTitle = '置顶资源';
    else if (sort === 'hot') viewTitle = '热门资源';
    else if (sort === 'latest') viewTitle = '最新资源';

    return (
      <div className="space-y-6 fade-in">
        {/* Hero 区 */}
        <Hero />

        {/* 搜索框 */}
        <SearchBox
          initialKeyword={keyword}
          initialCategory={category}
          currentSearch={currentSearch}
        />

        {/* 列表视图标题 */}
        <div className="flex items-center justify-between">
          <h2 className="section-title text-lg">
            {viewTitle}
            <span className="ml-2 text-sm font-normal text-text-muted">
              共 {result.total} 条
            </span>
          </h2>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-primary-300"
          >
            <ArrowRight size={12} className="rotate-180" />
            返回首页
          </Link>
        </div>

        {/* 卡片网格 / 空状态 */}
        {result.list.length > 0 ? (
          <PostGrid posts={result.list} />
        ) : (
          <Empty text="没有找到匹配的资源" />
        )}

        {/* 分页 */}
        {result.total_pages > 1 && (
          <div className="flex justify-center pt-2">
            <PaginationLink
              page={result.page}
              totalPages={result.total_pages}
              currentSearch={currentSearch}
            />
          </div>
        )}
      </div>
    );
  }

  // ---------- 默认视图：三大分区并行查询 ----------
  const [topResult, latestResult, hotResult] = await Promise.all([
    queryPosts({ page: 1, pageSize: TOP_LIMIT, sort: 'top' }),
    queryPosts({ page: 1, pageSize: LATEST_PAGE_SIZE, sort: 'latest' }),
    queryPosts({ page: 1, pageSize: HOT_LIMIT, sort: 'hot' }),
  ]);

  return (
    <div className="space-y-10 fade-in">
      {/* Hero 区 */}
      <Hero />

      {/* 搜索框 */}
      <SearchBox currentSearch={currentSearch} />

      {/* 置顶资源 */}
      <section>
        <SectionHeader
          icon={<Pin size={16} />}
          iconWrapCls="bg-danger/15 text-danger"
          title="置顶资源"
          moreHref="/?sort=top"
        />
        {topResult.list.length > 0 ? (
          <PostGrid posts={topResult.list} />
        ) : (
          <Empty text="暂无置顶资源" />
        )}
      </section>

      {/* 最新资源 */}
      <section>
        <SectionHeader
          icon={<Clock size={16} />}
          iconWrapCls="bg-primary-500/15 text-primary-300"
          title="最新资源"
          moreHref="/?sort=latest"
        />
        {latestResult.list.length > 0 ? (
          <PostGrid posts={latestResult.list} />
        ) : (
          <Empty text="暂无资源" />
        )}
      </section>

      {/* 热门资源 */}
      <section>
        <SectionHeader
          icon={<Flame size={16} />}
          iconWrapCls="bg-warning/15 text-warning"
          title="热门资源"
          moreHref="/?sort=hot"
        />
        {hotResult.list.length > 0 ? (
          <PostGrid posts={hotResult.list} />
        ) : (
          <Empty text="暂无热门资源" />
        )}
      </section>
    </div>
  );
}

// ============ Hero 子组件 ============

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary-700/20 via-bg-base to-bg-base px-6 py-10 md:px-10 md:py-14">
      {/* 装饰光斑 */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-primary-700/10 blur-3xl" />

      <div className="relative max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-xs text-primary-300">
          <Sparkles size={12} />
          安全合规的网盘资源分享社区
        </div>
        <h1 className="text-3xl font-bold leading-tight text-text-primary md:text-4xl">
          探索优质网盘资源
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-muted md:text-base">
          聚合软件工具与影视剧集资源，一站式发现、分享与交流。
          每一份资源都经过安全过滤，守护您的下载体验。
        </p>
      </div>
    </section>
  );
}
