'use client';

/**
 * 个人中心客户端组件
 * - 资料卡（头像/昵称/VIP/邮箱/简介/统计/编辑）
 * - 编辑资料对话框（极验校验）
 * - Tab 切换（URL searchParams 驱动）
 * - 帖子/评论/收藏/浏览记录列表
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Edit, Mail, X, Send } from 'lucide-react';
import type { Post, UserProfile, CaptchaTicket, PageResult } from '@/lib/types';
import { formatRegisterDuration, formatRelativeTime, isValidCaptchaTicket } from '@/lib/utils';
import PostCard from '@/components/PostCard';
import Pagination from '@/components/Pagination';
import Empty from '@/components/Empty';
import VipBadge from '@/components/VipBadge';
import GeetestWidget from '@/components/GeetestWidget';
import { useToast } from '@/components/Toast';

export type TabKey = 'posts' | 'comments' | 'collects' | 'history';

export interface UserCommentItem {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  post_title: string;
}

interface UserCenterClientProps {
  profile: UserProfile;
  currentUser: UserProfile | null;
  isOwner: boolean;
  activeTab: TabKey;
  showNoPermission: boolean;
  pageData: PageResult<Post | UserCommentItem>;
}

const TABS: { key: TabKey; label: string; ownerOnly?: boolean }[] = [
  { key: 'posts', label: '我的帖子' },
  { key: 'comments', label: '我的评论' },
  { key: 'collects', label: '收藏夹', ownerOnly: true },
  { key: 'history', label: '浏览记录', ownerOnly: true },
];

export default function UserCenterClient({
  profile,
  isOwner,
  activeTab,
  showNoPermission,
  pageData,
}: UserCenterClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // 编辑资料
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nickname: profile.nickname, avatar: profile.avatar, bio: profile.bio,
  });
  const [editCaptcha, setEditCaptcha] = useState<CaptchaTicket | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [editSubmitting, setEditSubmitting] = useState(false);

  function pushParams(tab: TabKey, page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    params.set('page', String(page));
    router.push(`?${params.toString()}`);
  }

  // ===== 提交编辑资料 =====
  async function handleEditSubmit() {
    if (!editForm.nickname.trim()) {
      toast.show('error', '请输入昵称');
      return;
    }
    if (!isValidCaptchaTicket(editCaptcha)) {
      toast.show('error', '请先完成人机验证');
      return;
    }
    setEditSubmitting(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: editForm.nickname,
          avatar: editForm.avatar,
          bio: editForm.bio,
          captcha: editCaptcha,
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', '资料已更新');
        setEditOpen(false);
        setEditCaptcha(null);
        setCaptchaKey((k) => k + 1);
        router.refresh();
      } else {
        toast.show('error', json.message || '更新失败');
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setEditSubmitting(false);
    }
  }

  // VIP 剩余天数
  const vipDays =
    profile.is_vip && profile.vip_expired_at
      ? Math.max(
          0,
          Math.ceil(
            (new Date(profile.vip_expired_at).getTime() - Date.now()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : 0;

  return (
    <div className="space-y-6 fade-in">
      {/* 资料卡 */}
      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* 头像 */}
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar}
              alt={profile.nickname}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full bg-primary-500/20 text-2xl font-bold text-primary-300">
              {(profile.nickname || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{profile.nickname}</h1>
              <VipBadge user={profile} />
              {profile.is_vip && vipDays > 0 && (
                <span className="text-xs text-gold-300">剩余 {vipDays} 天</span>
              )}
            </div>

            {/* 邮箱（本人可见） */}
            {isOwner && profile.email && (
              <div className="mt-1 flex items-center gap-1 text-sm text-text-muted">
                <Mail size={14} />
                {profile.email}
              </div>
            )}

            {/* 简介 */}
            <p className="mt-2 text-sm text-text-secondary">
              {profile.bio || '这家伙很懒，什么都没留下'}
            </p>

            {/* 统计 */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-dim">
              <span>注册 {formatRegisterDuration(profile.created_at)}</span>
              <span>发帖 {profile.post_count}</span>
              <span>评论 {profile.comment_count}</span>
            </div>
          </div>

          {/* 编辑按钮（本人） */}
          {isOwner && (
            <button onClick={() => setEditOpen(true)} className="btn-secondary">
              <Edit size={16} />
              编辑资料
            </button>
          )}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const locked = t.ownerOnly && !isOwner;
          return (
            <button
              key={t.key}
              onClick={() => pushParams(t.key, 1)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-primary-600 text-white'
                  : 'border border-border bg-bg-surface text-text-secondary hover:bg-bg-hover'
              } ${locked ? 'opacity-50' : ''}`}
            >
              {t.label}
              {locked && ' 🔒'}
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      {showNoPermission ? (
        <div className="card p-8 text-center text-sm text-text-muted">
          无权限查看此内容
        </div>
      ) : activeTab === 'comments' ? (
        <div className="space-y-3">
          {(pageData.list as UserCommentItem[]).length > 0 ? (
            (pageData.list as UserCommentItem[]).map((c) => (
              <div key={c.id} className="card p-4">
                <p className="whitespace-pre-wrap break-words text-sm text-text-secondary">
                  {c.content}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-text-dim">
                  <Link href={`/post/${c.post_id}`} className="link">
                    {c.post_title || '查看原帖'}
                  </Link>
                  <span>{formatRelativeTime(c.created_at)}</span>
                </div>
              </div>
            ))
          ) : (
            <Empty text="暂无评论" />
          )}
        </div>
      ) : (
        <div>
          {(pageData.list as Post[]).length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(pageData.list as Post[]).map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ) : (
            <Empty text="暂无数据" />
          )}
        </div>
      )}

      {/* 分页 */}
      {pageData.total_pages > 1 && (
        <div className="flex justify-center">
          <Pagination
            page={pageData.page}
            totalPages={pageData.total_pages}
            onChange={(p) => pushParams(activeTab, p)}
          />
        </div>
      )}

      {/* 编辑资料对话框 */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 fade-in">
          <div className="card w-full max-w-md p-5 slide-up">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">编辑资料</h3>
              <button
                onClick={() => setEditOpen(false)}
                className="text-text-dim hover:text-text-primary"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-text-dim">昵称</label>
                <input
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  className="input-field mt-1"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="text-xs text-text-dim">头像链接</label>
                <input
                  value={editForm.avatar}
                  onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })}
                  className="input-field mt-1"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="text-xs text-text-dim">个人简介</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="input-field mt-1 min-h-[80px] resize-y"
                  maxLength={200}
                />
              </div>
              <div>
                <GeetestWidget key={captchaKey} onVerified={(t) => setEditCaptcha(t)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditOpen(false)} className="btn-secondary">
                取消
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={editSubmitting}
                className="btn-primary"
              >
                <Send size={14} />
                {editSubmitting ? '提交中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
