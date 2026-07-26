'use client';

/**
 * 网盘资源卡片
 * 根据权限分四种展示：
 * 1. VIP 加密 + 无权限 → 金色边框 + Lock + 开通会员
 * 2. 公开 + 未登录 → 登录后查看
 * 3. 有权限 → 完整链接 + 提取码 + 复制 + 打开链接
 */

import Link from 'next/link';
import { Lock, Copy, ExternalLink, Crown } from 'lucide-react';
import type { PostDetail, UserProfile } from '@/lib/types';
import { PAN_TYPE_LABELS } from '@/lib/types';
import { useToast } from '@/components/Toast';

interface ResourceCardProps {
  post: PostDetail;
  currentUser: UserProfile | null;
}

export default function ResourceCard({ post, currentUser }: ResourceCardProps) {
  const toast = useToast();

  async function copy(text: string, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.show('success', `${label}已复制`);
    } catch {
      toast.show('error', '复制失败');
    }
  }

  // VIP 加密 + 无权限
  if (post.is_vip && !post.can_view_link) {
    return (
      <div className="card-gold p-5">
        <div className="flex items-center gap-2">
          <Lock className="text-gold-400" size={18} />
          <span className="tag tag-vip">VIP 专属资源</span>
          <span className="tag">{PAN_TYPE_LABELS[post.pan_type]}</span>
        </div>
        <p className="mt-3 text-sm text-text-secondary">开通会员查看完整链接</p>
        <div className="mt-2 break-all rounded-md bg-bg-elevated px-3 py-2 text-xs text-text-muted">
          {post.masked_pan_url || post.pan_url}
        </div>
        <Link href="/vip" className="btn-gold mt-4">
          <Crown size={16} />
          开通会员
        </Link>
      </div>
    );
  }

  // 公开 + 未登录
  if (!post.is_vip && !currentUser && !post.can_view_link) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Lock className="text-primary-400" size={18} />
          <span className="tag">{PAN_TYPE_LABELS[post.pan_type]}</span>
        </div>
        <p className="mt-3 text-sm text-text-secondary">登录后查看完整链接</p>
        <div className="mt-2 break-all rounded-md bg-bg-elevated px-3 py-2 text-xs text-text-muted">
          {post.masked_pan_url || post.pan_url}
        </div>
        <Link href="/login" className="btn-primary mt-4">
          登录查看
        </Link>
      </div>
    );
  }

  // 有权限查看
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <span className="tag">{PAN_TYPE_LABELS[post.pan_type]}</span>
      </div>
      <div className="mt-3">
        <div className="text-xs text-text-dim">网盘链接</div>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 break-all rounded-md bg-bg-elevated px-3 py-2 text-sm text-text-primary">
            {post.pan_url}
          </code>
          <button
            onClick={() => copy(post.pan_url, '链接')}
            className="btn-secondary shrink-0"
            aria-label="复制链接"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>
      {post.pan_code && (
        <div className="mt-3">
          <div className="text-xs text-text-dim">提取码</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-bg-elevated px-3 py-2 text-sm text-text-primary">
              {post.pan_code}
            </code>
            <button
              onClick={() => copy(post.pan_code, '提取码')}
              className="btn-secondary shrink-0"
              aria-label="复制提取码"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}
      <a
        href={post.pan_url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary mt-4"
      >
        <ExternalLink size={16} />
        打开链接
      </a>
    </div>
  );
}
