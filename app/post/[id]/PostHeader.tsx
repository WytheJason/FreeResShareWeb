/**
 * 帖子主体展示卡片（封面/标题/标签/网盘类型/作者/简介）
 * 纯展示组件，由 PostDetailClient 调用
 */

import { Eye, MessageCircle, Pin, Crown, Coins, Unlock } from 'lucide-react';
import type { PostDetail } from '@/lib/types';
import { CATEGORY_LABELS, PAN_TYPE_ICONS, PAN_TYPE_LABELS } from '@/lib/types';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import Avatar from '@/components/Avatar';

interface PostHeaderProps {
  post: PostDetail;
}

export default function PostHeader({ post }: PostHeaderProps) {
  const categoryLabel = CATEGORY_LABELS[post.category];
  const panIconUrl = PAN_TYPE_ICONS[post.pan_type];

  return (
    <div className="card overflow-hidden">
      {/* 封面 */}
      <div className="relative w-full bg-bg-elevated">
        {post.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover_url}
            alt={post.title}
            className="max-h-96 w-full object-contain"
          />
        ) : (
          <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-primary-600/30 via-primary-700/20 to-bg-surface">
            <span className="text-sm text-text-dim">{categoryLabel}</span>
          </div>
        )}
      </div>

      <div className="p-6">
        {/* 标题 */}
        <h1 className="text-3xl font-bold text-text-primary">{post.title}</h1>

        {/* 标签行 */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-dim">
          <span className={`tag ${post.category === 'software' ? 'tag-software' : 'tag-movie'}`}>
            {categoryLabel}
          </span>
          {/* 网盘类型标签 */}
          <span className="tag bg-bg-elevated text-text-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={panIconUrl}
              alt={PAN_TYPE_LABELS[post.pan_type]}
              className="mr-1 h-3 w-3"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            {PAN_TYPE_LABELS[post.pan_type]}
          </span>
          {post.is_top && (
            <span className="tag bg-danger/20 text-danger">
              <Pin size={10} /> 置顶
            </span>
          )}
          {post.is_vip && (
            <span className="tag tag-vip">
              <Crown size={10} /> VIP
            </span>
          )}
          {post.points_cost > 0 && (
            <span className="tag bg-purple-500/20 text-purple-300">
              <Coins size={10} /> {post.points_cost}积分
            </span>
          )}
          {post.need_login === false && (
            <span className="tag bg-green-500/20 text-green-300">
              <Unlock size={10} /> 公开
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye size={12} /> {post.view_count}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={12} /> {post.comment_count}
          </span>
          <span>· {formatDateTime(post.created_at)}</span>
        </div>

        {/* 作者 */}
        <div className="mt-4 flex items-center gap-3">
          <Avatar
            src={post.author_avatar}
            name={post.author_nickname}
            className="h-10 w-10"
          />
          <div>
            <div className="text-sm font-medium text-text-primary">
              {post.author_nickname || '匿名'}
            </div>
            <div className="text-xs text-text-dim">
              {formatRelativeTime(post.created_at)} 发布
            </div>
          </div>
        </div>

        {/* 简介 */}
        {post.description && (
          <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-secondary">
            {post.description}
          </div>
        )}
      </div>
    </div>
  );
}
