'use client';

/**
 * 网盘资源卡片（支持多链接展示）
 * 根据权限分五种展示：
 * 1. 积分资源 + 未解锁 → 紫色边框 + Coins 图标 + 积分解锁按钮
 * 2. VIP 加密 + 无权限 → 金色边框 + Lock + 开通会员
 * 3. 公开 + 未登录 → 登录后查看
 * 4. 已解锁/有权限 → 完整链接列表 + 提取码 + 复制 + 打开链接
 */

import { useState } from 'react';
import Link from 'next/link';
import { Lock, Copy, ExternalLink, Crown, Coins, Sparkles } from 'lucide-react';
import type { PostDetail, UserProfile, PanLink } from '@/lib/types';
import { PAN_TYPE_LABELS } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { Spinner } from '@/components/Loading';

interface ResourceCardProps {
  post: PostDetail;
  currentUser: UserProfile | null;
}

export default function ResourceCard({ post, currentUser }: ResourceCardProps) {
  const toast = useToast();
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(post.is_unlocked);

  async function copy(text: string, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.show('success', `${label}已复制`);
    } catch {
      toast.show('error', '复制失败');
    }
  }

  // 获取用于展示的链接列表（脱敏或真实）
  const displayLinks: PanLink[] =
    post.pan_links ?? post.masked_pan_links ?? [
      { type: post.pan_type, url: post.pan_url, code: post.pan_code },
    ];

  // 渲染脱敏链接列表（用于未授权状态）
  function renderMaskedLinks() {
    return (
      <div className="mt-2 space-y-1.5">
        {displayLinks.map((link, idx) => (
          <div
            key={idx}
            className="break-all rounded-md bg-bg-elevated px-3 py-2 text-xs text-text-muted"
          >
            <span className="mr-2 text-text-dim">[{PAN_TYPE_LABELS[link.type]}]</span>
            {link.url}
          </div>
        ))}
      </div>
    );
  }

  // 积分资源 + 未解锁（优先级最高）
  if (post.points_cost > 0 && !unlocked) {
    // 未登录 → 提示登录
    if (!currentUser) {
      return (
        <div className="card border-purple-500/30 p-5">
          <div className="flex items-center gap-2">
            <Coins className="text-purple-400" size={18} />
            <span className="tag bg-purple-500/15 text-purple-300">积分资源</span>
            {displayLinks.length > 1 && (
              <span className="tag">{displayLinks.length} 个链接</span>
            )}
          </div>
          <p className="mt-3 text-sm text-text-secondary">
            需要 <span className="font-bold text-purple-300">{post.points_cost}</span> 积分解锁查看
          </p>
          {renderMaskedLinks()}
          <Link href="/login" className="btn-primary mt-4">
            登录后解锁
          </Link>
        </div>
      );
    }

    // 已登录但积分不足或足够 → 显示解锁按钮
    const hasEnoughPoints = currentUser.points >= post.points_cost;
    return (
      <div className="card border-purple-500/30 p-5">
        <div className="flex items-center gap-2">
          <Coins className="text-purple-400" size={18} />
          <span className="tag bg-purple-500/15 text-purple-300">积分资源</span>
          {displayLinks.length > 1 && (
            <span className="tag">{displayLinks.length} 个链接</span>
          )}
        </div>
        <p className="mt-3 text-sm text-text-secondary">
          需要 <span className="font-bold text-purple-300">{post.points_cost}</span> 积分解锁查看
        </p>
        <div className="mt-2 flex items-center justify-between rounded-md bg-bg-elevated px-3 py-2 text-xs">
          <span className="text-text-muted">当前积分</span>
          <span className={`font-bold ${hasEnoughPoints ? 'text-green-400' : 'text-danger'}`}>
            {currentUser.points} 积分
          </span>
        </div>
        {renderMaskedLinks()}

        {hasEnoughPoints ? (
          <button
            onClick={handleUnlock}
            disabled={unlocking}
            className="btn-primary mt-4 w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400"
          >
            {unlocking ? (
              <>
                <Spinner />
                解锁中...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                消耗 {post.points_cost} 积分解锁
              </>
            )}
          </button>
        ) : (
          <Link href={`/user/${currentUser.id}?tab=points`} className="btn-primary mt-4 w-full">
            <Coins size={16} />
            积分不足，去赚取积分
          </Link>
        )}
      </div>
    );
  }

  // VIP 加密 + 无权限
  if (post.is_vip && !post.can_view_link) {
    return (
      <div className="card-gold p-5">
        <div className="flex items-center gap-2">
          <Lock className="text-gold-400" size={18} />
          <span className="tag tag-vip">VIP 专属资源</span>
          {displayLinks.length > 1 && (
            <span className="tag">{displayLinks.length} 个链接</span>
          )}
        </div>
        <p className="mt-3 text-sm text-text-secondary">开通会员查看完整链接</p>
        {renderMaskedLinks()}
        <Link href="/vip" className="btn-gold mt-4">
          <Crown size={16} />
          开通会员
        </Link>
      </div>
    );
  }

  // 公开 + 未登录
  if (!post.is_vip && post.points_cost === 0 && !currentUser && !post.can_view_link) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Lock className="text-primary-400" size={18} />
          {displayLinks.length > 1 && (
            <span className="tag">{displayLinks.length} 个链接</span>
          )}
        </div>
        <p className="mt-3 text-sm text-text-secondary">登录后查看完整链接</p>
        {renderMaskedLinks()}
        <Link href="/login" className="btn-primary mt-4">
          登录查看
        </Link>
      </div>
    );
  }

  // 有权限查看（含已解锁）— 展示所有链接
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <span className="tag">{displayLinks.length} 个网盘链接</span>
        {unlocked && post.points_cost > 0 && (
          <span className="tag bg-purple-500/15 text-purple-300">
            <Coins size={12} className="mr-1" />
            已解锁
          </span>
        )}
      </div>

      {/* 多链接列表 */}
      <div className="mt-3 space-y-4">
        {displayLinks.map((link, idx) => (
          <div key={idx} className="rounded-lg border border-border bg-bg-surface/50 p-3">
            {/* 链接标题 */}
            <div className="mb-2 flex items-center gap-2">
              <span className="tag bg-primary-500/15 text-primary-300">
                {PAN_TYPE_LABELS[link.type]}
              </span>
              <span className="text-xs text-text-dim">链接 {idx + 1}</span>
            </div>

            {/* 网盘链接 */}
            <div>
              <div className="text-xs text-text-dim">网盘链接</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 break-all rounded-md bg-bg-elevated px-3 py-2 text-sm text-text-primary">
                  {link.url}
                </code>
                <button
                  onClick={() => copy(link.url, `${PAN_TYPE_LABELS[link.type]}链接`)}
                  className="btn-secondary shrink-0"
                  aria-label="复制链接"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {/* 提取码 */}
            {link.code && (
              <div className="mt-2">
                <div className="text-xs text-text-dim">提取码</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 break-all rounded-md bg-bg-elevated px-3 py-2 text-sm text-text-primary">
                    {link.code}
                  </code>
                  <button
                    onClick={() => copy(link.code, `${PAN_TYPE_LABELS[link.type]}提取码`)}
                    className="btn-secondary shrink-0"
                    aria-label="复制提取码"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* 打开链接按钮 */}
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-3 w-full"
            >
              <ExternalLink size={14} />
              打开{PAN_TYPE_LABELS[link.type]}链接
            </a>
          </div>
        ))}
      </div>
    </div>
  );

  // ---------- 积分解锁处理 ----------
  async function handleUnlock() {
    if (unlocking) return;
    setUnlocking(true);
    try {
      const res = await fetch('/api/post/unlock', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      });

      if (res.status === 401) {
        toast.show('error', '登录已过期，请重新登录');
        return;
      }

      const data = await res.json();
      if (data.code === 0) {
        toast.show('success', data.message || '解锁成功');
        setUnlocked(true);
        // 刷新页面以获取完整资源链接
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast.show('error', data.message || '解锁失败');
      }
    } catch {
      toast.show('error', '网络错误，请稍后重试');
    } finally {
      setUnlocking(false);
    }
  }
}
