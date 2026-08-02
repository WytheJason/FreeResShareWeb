import Link from 'next/link';
import { Eye, MessageCircle, Crown, Pin, Coins } from 'lucide-react';
import type { Post } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

interface PostCardProps {
  post: Post;
}

/**
 * 帖子卡片
 * 整卡可点击跳转 /post/[id]
 * 顶部封面图（无图渐变占位）+ 标题 + 简介 + 作者/浏览/评论信息
 */
export default function PostCard({ post }: PostCardProps) {
  const categoryTagCls =
    post.category === 'software' ? 'tag tag-software' : 'tag tag-movie';

  return (
    <Link
      href={`/post/${post.id}`}
      className="card group block overflow-hidden transition-colors hover:border-primary-500/50"
    >
      {/* 封面图 */}
      <div className="relative aspect-video w-full overflow-hidden bg-bg-elevated">
        {post.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover_url}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-600/30 via-primary-700/20 to-bg-surface">
            <span className="text-xs text-text-dim">{CATEGORY_LABELS[post.category]}</span>
          </div>
        )}

        {/* 分类标签 - 左上角 */}
        <span className={`absolute left-2 top-2 ${categoryTagCls}`}>
          {CATEGORY_LABELS[post.category]}
        </span>

        {/* 置顶 / VIP / 积分 标签 - 右上角 */}
        <div className="absolute right-2 top-2 flex gap-1">
          {post.is_top && (
            <span className="tag bg-danger/20 text-danger">
              <Pin size={10} />
              置顶
            </span>
          )}
          {post.is_vip && (
            <span className="tag tag-vip">
              <Crown size={10} />
              VIP
            </span>
          )}
          {post.points_cost > 0 && (
            <span className="tag bg-purple-500/20 text-purple-300">
              <Coins size={10} />
              {post.points_cost}积分
            </span>
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div className="p-4">
        {/* 标题 */}
        <h3 className="truncate text-base font-semibold text-text-primary transition-colors group-hover:text-primary-300">
          {post.title}
        </h3>
        {/* 简介 */}
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-text-muted">
          {post.description || '暂无简介'}
        </p>

        {/* 底部信息 */}
        <div className="mt-3 flex items-center justify-between text-xs text-text-dim">
          <div className="flex min-w-0 items-center gap-2">
            {post.author_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.author_avatar}
                alt={post.author_nickname}
                className="h-5 w-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-500/20 text-[10px] text-primary-300">
                {(post.author_nickname || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="max-w-[6rem] truncate">{post.author_nickname || '匿名'}</span>
            <span>·</span>
            <span className="shrink-0">{formatRelativeTime(post.created_at)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {post.view_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={12} />
              {post.comment_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
