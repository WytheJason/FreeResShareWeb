'use client';

/**
 * 个人中心客户端组件（完整版）
 * - 顶部资料卡：头像/昵称/VIP/邮箱/简介/注册时间/复制ID/编辑资料
 * - 数据总览：发帖、评论、收藏、浏览、积分、邀请 6 项数据卡片
 * - 用户等级：根据发帖+评论计算等级，展示进度条
 * - 快捷入口：发布资源、VIP 专区、返回首页、复制分享链接、邀请好友
 * - Tab 切换（URL searchParams 驱动）：我的帖子、我的评论、收藏夹、浏览记录、积分
 * - 两个对话框：编辑资料（Turnstile 校验）、修改密码
 */

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Edit,
  Mail,
  X,
  Send,
  FileText,
  MessageSquare,
  Heart,
  Eye,
  Upload,
  Crown,
  Home,
  Link as LinkIcon,
  Copy,
  Check,
  Shield,
  KeyRound,
  LogOut,
  Calendar,
  User as UserIcon,
  AlertTriangle,
  EyeOff,
  Coins,
  UserPlus,
} from 'lucide-react';
import type { Post, UserProfile, PageResult } from '@/lib/types';
import { formatRegisterDuration, formatRelativeTime } from '@/lib/utils';
import PostCard from '@/components/PostCard';
import Pagination from '@/components/Pagination';
import Empty from '@/components/Empty';
import VipBadge from '@/components/VipBadge';
import TurnstileWidget, { type TurnstileWidgetHandle } from '@/components/TurnstileWidget';
import PointsPanel from './PointsPanel';
import { useToast } from '@/components/Toast';

export type TabKey = 'posts' | 'comments' | 'collects' | 'history' | 'points';

export interface UserCommentItem {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  post_title: string;
}

export interface UserStats {
  post_count: number;
  comment_count: number;
  collect_count: number;
  view_count: number;
  /** 当前积分余额 */
  points: number;
  /** 成功邀请人数 */
  invite_count: number;
}

interface UserCenterClientProps {
  profile: UserProfile;
  currentUser: UserProfile | null;
  isOwner: boolean;
  activeTab: TabKey;
  showNoPermission: boolean;
  pageData: PageResult<Post | UserCommentItem>;
  userStats: UserStats;
}

const TABS: { key: TabKey; label: string; icon: typeof FileText; ownerOnly?: boolean }[] = [
  { key: 'posts', label: '我的帖子', icon: FileText },
  { key: 'comments', label: '我的评论', icon: MessageSquare },
  { key: 'collects', label: '收藏夹', icon: Heart, ownerOnly: true },
  { key: 'history', label: '浏览记录', icon: Eye, ownerOnly: true },
  { key: 'points', label: '积分', icon: Coins },
];

// ============ 等级系统 ============
// 等级 = 发帖 * 2 + 评论
// Lv1: 0~9 | Lv2: 10~29 | Lv3: 30~59 | Lv4: 60~99 | Lv5: 100~149
// Lv6: 150~209 | Lv7: 210~279 | Lv8: 280~359 | Lv9: 360+
const LEVEL_THRESHOLDS = [0, 10, 30, 60, 100, 150, 210, 280, 360];
const MAX_LEVEL = 9;

function calcLevel(postCount: number, commentCount: number) {
  const score = postCount * 2 + commentCount;
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (score >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  level = Math.min(level, MAX_LEVEL);
  const curThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? curThreshold + 100;
  const progress = level >= MAX_LEVEL
    ? 100
    : Math.min(100, Math.round(((score - curThreshold) / (nextThreshold - curThreshold)) * 100));
  const toNext = level >= MAX_LEVEL ? 0 : nextThreshold - score;
  return { level, score, progress, toNext };
}

// 等级颜色映射
function getLevelColor(level: number) {
  if (level >= 8) return 'from-purple-500 to-pink-500';
  if (level >= 6) return 'from-gold-400 to-gold-600';
  if (level >= 4) return 'from-primary-400 to-primary-600';
  return 'from-gray-400 to-gray-600';
}

export default function UserCenterClient({
  profile,
  isOwner,
  activeTab,
  showNoPermission,
  pageData,
  userStats,
}: UserCenterClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // ========== 编辑资料 ==========
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nickname: profile.nickname,
    avatar: profile.avatar,
    bio: profile.bio,
  });
  const editTurnstileRef = useRef<TurnstileWidgetHandle>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ========== 修改密码 ==========
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPwd: '', newPwd: '', confirmPwd: '' });
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // ========== 复制 ID ==========
  const [copiedId, setCopiedId] = useState(false);

  // ========== 复制邀请码 ==========
  const [copiedInvite, setCopiedInvite] = useState(false);

  // ========== VIP 剩余天数 ==========
  const vipDays = useMemo(() => {
    if (!profile.is_vip || !profile.vip_expired_at) return 0;
    return Math.max(
      0,
      Math.ceil(
        (new Date(profile.vip_expired_at).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000)
      )
    );
  }, [profile.is_vip, profile.vip_expired_at]);

  // ========== 等级计算 ==========
  const levelInfo = useMemo(
    () => calcLevel(userStats.post_count, userStats.comment_count),
    [userStats.post_count, userStats.comment_count]
  );

  function pushParams(tab: TabKey, page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    params.set('page', String(page));
    router.push(`?${params.toString()}`);
  }

  // ========== 提交编辑资料 ==========
  async function handleEditSubmit() {
    if (!editForm.nickname.trim()) {
      toast.show('error', '请输入昵称');
      return;
    }
    setEditSubmitting(true);
    try {
      const token = await editTurnstileRef.current?.getToken();
      if (!token) {
        setEditSubmitting(false);
        return;
      }
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: editForm.nickname,
          avatar: editForm.avatar,
          bio: editForm.bio,
          captcha: { type: 'turnstile', token },
        }),
      });

      // 401 表示登录态已失效
      if (res.status === 401) {
        toast.show('error', '登录状态已失效，请重新登录');
        editTurnstileRef.current?.reset();
        router.push('/login');
        return;
      }

      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', '资料已更新');
        setEditOpen(false);
        editTurnstileRef.current?.reset();
        router.refresh();
      } else {
        toast.show('error', json.message || '更新失败');
        editTurnstileRef.current?.reset();
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setEditSubmitting(false);
    }
  }

  // ========== 提交修改密码 ==========
  async function handlePwdSubmit() {
    if (!pwdForm.oldPwd) { toast.show('error', '请输入原密码'); return; }
    if (!pwdForm.newPwd) { toast.show('error', '请输入新密码'); return; }
    if (pwdForm.newPwd.length < 8 || pwdForm.newPwd.length > 32) {
      toast.show('error', '新密码长度需 8-32 位');
      return;
    }
    if (!/[a-zA-Z]/.test(pwdForm.newPwd) || !/[0-9]/.test(pwdForm.newPwd)) {
      toast.show('error', '新密码必须同时包含字母和数字');
      return;
    }
    if (pwdForm.newPwd !== pwdForm.confirmPwd) {
      toast.show('error', '两次输入的新密码不一致');
      return;
    }
    if (pwdForm.oldPwd === pwdForm.newPwd) {
      toast.show('error', '新密码不能与原密码相同');
      return;
    }
    setPwdSubmitting(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: pwdForm.oldPwd,
          newPassword: pwdForm.newPwd,
        }),
      });

      // 401 表示登录态已失效
      if (res.status === 401) {
        toast.show('error', '登录状态已失效，请重新登录');
        router.push('/login');
        return;
      }

      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', '密码修改成功');
        setPwdOpen(false);
        setPwdForm({ oldPwd: '', newPwd: '', confirmPwd: '' });
        // 密码修改后清除登录态并跳转登录页
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        setTimeout(() => router.push('/login'), 1000);
      } else {
        toast.show('error', json.message || '修改失败');
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setPwdSubmitting(false);
    }
  }

  // ========== 退出登录 ==========
  async function handleLogout() {
    if (!window.confirm('确定要退出登录吗？')) return;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.show('success', '已退出登录');
      router.push('/');
    } catch {
      toast.show('error', '退出失败');
    }
  }

  // ========== 复制用户 ID ==========
  async function handleCopyId() {
    try {
      await navigator.clipboard.writeText(profile.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      toast.show('success', 'ID 已复制');
    } catch {
      toast.show('error', '复制失败');
    }
  }

  // ========== 复制邀请码 ==========
  async function handleCopyInviteCode() {
    if (!profile.invite_code) {
      toast.show('error', '暂无邀请码');
      return;
    }
    try {
      await navigator.clipboard.writeText(profile.invite_code);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
      toast.show('success', '邀请码已复制');
    } catch {
      toast.show('error', '复制失败');
    }
  }

  // ========== 复制分享链接 ==========
  async function handleCopyLink() {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      await navigator.clipboard.writeText(url);
      toast.show('success', '个人主页链接已复制');
    } catch {
      toast.show('error', '复制失败');
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* ===== 顶部资料卡 ===== */}
      <div className="card p-6 overflow-hidden relative">
        {/* VIP 渐变背景 */}
        {profile.is_vip && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold-500/5 via-transparent to-primary-500/5" />
        )}

        {/* 账号封禁提示（他人访问时） */}
        {profile.is_banned && !isOwner && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertTriangle size={14} />
            该账号已被封禁
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center relative">
          {/* 头像 */}
          <div className="relative">
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar}
                alt={profile.nickname}
                className="h-24 w-24 rounded-2xl object-cover ring-2 ring-primary-500/30"
              />
            ) : (
              <div className="grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-primary-500/30 to-primary-700/30 text-3xl font-bold text-primary-300">
                {(profile.nickname || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            {/* 管理员徽标 */}
            {profile.is_admin && (
              <div className="absolute -right-1 -bottom-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                管理
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* 昵称 + VIP + 等级 */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary truncate">
                {profile.nickname}
              </h1>
              <VipBadge user={profile} />
              {profile.is_vip && vipDays > 0 && (
                <span className="text-xs text-gold-300 bg-gold-500/10 rounded px-2 py-0.5">
                  VIP 剩 {vipDays} 天
                </span>
              )}
              {profile.points > 0 && (
                <span className="text-xs text-purple-300 bg-purple-500/10 rounded px-2 py-0.5">
                  {profile.points} 积分
                </span>
              )}
              <span
                className={`text-xs font-bold bg-gradient-to-r ${getLevelColor(levelInfo.level)} bg-clip-text text-transparent border border-border rounded px-2 py-0.5`}
              >
                Lv.{levelInfo.level}
              </span>
              {profile.is_banned && (
                <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-0.5">
                  已封禁
                </span>
              )}
            </div>

            {/* 邮箱 + 注册时间 */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
              {isOwner && profile.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail size={14} />
                  {profile.email}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar size={14} />
                {formatRegisterDuration(profile.created_at)} 加入
              </span>
              {isOwner && (
                <button
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 hover:text-primary-400 transition-colors"
                  title="复制用户 ID"
                >
                  {copiedId ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  ID: {profile.id.slice(0, 8)}...
                </button>
              )}
            </div>

            {/* 简介 */}
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              {profile.bio || '这家伙很懒，什么都没留下'}
            </p>
          </div>

          {/* 操作按钮（仅本人可见） */}
          {isOwner && (
            <div className="flex flex-col gap-2 sm:items-end">
              <button onClick={() => setEditOpen(true)} className="btn-primary">
                <Edit size={16} />
                编辑资料
              </button>
              <div className="flex gap-2">
                <button onClick={() => setPwdOpen(true)} className="btn-secondary text-xs">
                  <KeyRound size={14} />
                  改密码
                </button>
                <button onClick={handleLogout} className="btn-secondary text-xs text-red-400 hover:text-red-300 border-red-500/30">
                  <LogOut size={14} />
                  退出
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 等级进度条（仅本人或公开） */}
        <div className="mt-5 pt-5 border-t border-border">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-text-dim flex items-center gap-1">
              <UserIcon size={12} />
              活跃成长 Lv.{levelInfo.level} / Lv.{MAX_LEVEL}
              <span className="text-text-muted ml-1">
                ({levelInfo.score} 分)
              </span>
            </span>
            <span className="text-text-muted">
              {levelInfo.level >= MAX_LEVEL
                ? '已满级'
                : `距 Lv.${levelInfo.level + 1} 还需 ${levelInfo.toNext} 分`}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-bg-surface overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getLevelColor(levelInfo.level)} transition-all duration-500`}
              style={{ width: `${levelInfo.progress}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-text-dim">
            成长分 = 发帖 × 2 + 评论（他人访问显示 0）
          </p>
        </div>
      </div>

      {/* ===== 数据总览卡片 ===== */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: '发帖总数',
            value: userStats.post_count,
            icon: FileText,
            color: 'from-blue-500/20 to-blue-600/10 text-blue-400',
          },
          {
            label: '评论总数',
            value: userStats.comment_count,
            icon: MessageSquare,
            color: 'from-green-500/20 to-green-600/10 text-green-400',
          },
          {
            label: isOwner ? '收藏数' : '收藏数（不可见）',
            value: isOwner ? userStats.collect_count : 0,
            icon: isOwner ? Heart : EyeOff,
            color: 'from-pink-500/20 to-pink-600/10 text-pink-400',
            locked: !isOwner,
          },
          {
            label: isOwner ? '浏览记录' : '浏览（不可见）',
            value: isOwner ? userStats.view_count : 0,
            icon: isOwner ? Eye : EyeOff,
            color: 'from-purple-500/20 to-purple-600/10 text-purple-400',
            locked: !isOwner,
          },
          {
            label: '积分余额',
            value: userStats.points,
            icon: Coins,
            color: 'from-purple-500/20 to-purple-600/10 text-purple-400',
          },
          {
            label: '邀请人数',
            value: userStats.invite_count,
            icon: UserPlus,
            color: 'from-blue-500/20 to-blue-600/10 text-blue-400',
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`card p-4 bg-gradient-to-br ${item.color.split(' ').slice(0, 2).join(' ')} relative overflow-hidden`}
          >
            <div className={`${item.color.split(' ').slice(2).join(' ')} flex items-start justify-between`}>
              <div>
                <p className="text-xs opacity-70">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">
                  {item.value.toLocaleString()}
                </p>
              </div>
              <div className={`${item.color.split(' ')[2]} opacity-60`}>
                <item.icon size={24} />
              </div>
            </div>
            {item.locked && (
              <div className="absolute top-2 right-2 text-[10px] text-text-dim bg-bg-surface/50 rounded px-1">
                仅本人
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ===== 快捷入口（仅本人） ===== */}
      {isOwner && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link href="/publish" className="card p-4 hover:bg-bg-hover transition-colors group">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-500/20 text-primary-400 group-hover:bg-primary-500/30 transition-colors">
                <Upload size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">发布资源</p>
                <p className="text-[10px] text-text-dim">分享你的资源</p>
              </div>
            </div>
          </Link>

          <Link href="/vip" className="card p-4 hover:bg-bg-hover transition-colors group">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-gold-500/20 text-gold-400 group-hover:bg-gold-500/30 transition-colors">
                <Crown size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">VIP 专区</p>
                <p className="text-[10px] text-text-dim">
                  {profile.is_vip ? '查看特权详情' : '升级 VIP'}
                </p>
              </div>
            </div>
          </Link>

          <Link href="/" className="card p-4 hover:bg-bg-hover transition-colors group">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-green-500/20 text-green-400 group-hover:bg-green-500/30 transition-colors">
                <Home size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">返回首页</p>
                <p className="text-[10px] text-text-dim">浏览最新资源</p>
              </div>
            </div>
          </Link>

          <button
            onClick={handleCopyLink}
            className="card p-4 hover:bg-bg-hover transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30 transition-colors">
                <LinkIcon size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">复制主页</p>
                <p className="text-[10px] text-text-dim">分享给好友</p>
              </div>
            </div>
          </button>

          {/* 邀请好友 */}
          <div className="card p-4 hover:bg-bg-hover transition-colors group">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 transition-colors">
                <UserPlus size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">邀请好友</p>
                <p className="text-[10px] text-text-dim truncate">
                  邀请码：{profile.invite_code || '—'}
                </p>
              </div>
              <button
                onClick={handleCopyInviteCode}
                className="text-text-dim hover:text-primary-400 transition-colors shrink-0"
                title="复制邀请码"
              >
                {copiedInvite ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Tab 切换 ===== */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const locked = t.ownerOnly && !isOwner;
          return (
            <button
              key={t.key}
              onClick={() => !locked && pushParams(t.key, 1)}
              disabled={locked}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                  : 'border border-border bg-bg-surface text-text-secondary hover:bg-bg-hover'
              } ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <t.icon size={14} />
              {t.label}
              {locked && ' 🔒'}
            </button>
          );
        })}
      </div>

      {/* ===== 内容区 ===== */}
      {showNoPermission ? (
        <div className="card p-8 text-center text-sm">
          <Shield size={32} className="mx-auto mb-3 text-text-dim opacity-50" />
          <p className="text-text-muted">这是用户的隐私数据，仅本人可查看</p>
        </div>
      ) : activeTab === 'points' ? (
        <PointsPanel profile={profile} isOwner={isOwner} />
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
            <Empty
              text={
                activeTab === 'posts'
                  ? '还没有发帖，去发布你的第一个资源吧'
                  : activeTab === 'collects'
                  ? '收藏夹还是空的'
                  : '暂无浏览记录'
              }
            />
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

      {/* ===== 编辑资料对话框 ===== */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 fade-in">
          <div className="card w-full max-w-md p-5 slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">编辑资料</h3>
              <button
                onClick={() => setEditOpen(false)}
                className="text-text-dim hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-text-dim">昵称 <span className="text-red-400">*</span></label>
                <input
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  className="input-field mt-1"
                  maxLength={20}
                  placeholder="1-20 个字符"
                />
              </div>
              <div>
                <label className="text-xs text-text-dim">头像链接</label>
                <input
                  value={editForm.avatar}
                  onChange={(e) => setEditForm({ ...editForm, avatar: e.target.value })}
                  className="input-field mt-1"
                  placeholder="https://... 图片地址"
                />
                {editForm.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={editForm.avatar}
                    alt="预览"
                    className="mt-2 h-16 w-16 rounded-lg object-cover border border-border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-text-dim">个人简介</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="input-field mt-1 min-h-[80px] resize-y"
                  maxLength={200}
                  placeholder="介绍一下自己，最多 200 字"
                />
                <p className="mt-1 text-[10px] text-text-dim text-right">
                  {editForm.bio.length}/200
                </p>
              </div>
              <div>
                <TurnstileWidget
                  ref={editTurnstileRef}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  onSuccess={() => {}}
                />
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

      {/* ===== 修改密码对话框 ===== */}
      {pwdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 fade-in">
          <div className="card w-full max-w-md p-5 slide-up">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Shield size={18} />
                修改密码
              </h3>
              <button
                onClick={() => { setPwdOpen(false); setPwdForm({ oldPwd: '', newPwd: '', confirmPwd: '' }); }}
                className="text-text-dim hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-text-dim">原密码 <span className="text-red-400">*</span></label>
                <input
                  type="password"
                  value={pwdForm.oldPwd}
                  onChange={(e) => setPwdForm({ ...pwdForm, oldPwd: e.target.value })}
                  className="input-field mt-1"
                  placeholder="请输入当前密码"
                />
              </div>
              <div>
                <label className="text-xs text-text-dim">
                  新密码 <span className="text-red-400">*</span>
                  <span className="text-text-dim ml-1">(8-32位，字母+数字)</span>
                </label>
                <input
                  type="password"
                  value={pwdForm.newPwd}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPwd: e.target.value })}
                  className="input-field mt-1"
                  placeholder="请输入新密码"
                />
              </div>
              <div>
                <label className="text-xs text-text-dim">确认新密码 <span className="text-red-400">*</span></label>
                <input
                  type="password"
                  value={pwdForm.confirmPwd}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPwd: e.target.value })}
                  className="input-field mt-1"
                  placeholder="再次输入新密码"
                />
              </div>
              {pwdForm.newPwd && pwdForm.confirmPwd && pwdForm.newPwd !== pwdForm.confirmPwd && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  两次输入的密码不一致
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setPwdOpen(false); setPwdForm({ oldPwd: '', newPwd: '', confirmPwd: '' }); }}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handlePwdSubmit}
                disabled={pwdSubmitting}
                className="btn-primary"
              >
                <KeyRound size={14} />
                {pwdSubmitting ? '提交中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
