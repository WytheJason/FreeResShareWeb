'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  X,
  User,
  LogOut,
  Sparkles,
  ChevronDown,
  Coins,
  UserPlus,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/types';
import { getSupabaseBrowser } from '@/lib/supabase';

interface NavItem {
  label: string;
  href: string;
  /** 是否仅管理员可见 */
  adminOnly?: boolean;
  /** 是否仅登录用户可见 */
  authOnly?: boolean;
}

// 顶部导航项
const NAV_ITEMS: NavItem[] = [
  { label: '首页', href: '/' },
  { label: '发布资源', href: '/publish' },
  { label: '邀请好友', href: '/invite', authOnly: true },
  { label: 'VIP 专区', href: '/vip' },
  { label: '管理员后台', href: '/admin', adminOnly: true },
];

/**
 * 将 Supabase Auth User 映射为 UserProfile（取 user_metadata 字段）
 */
function mapUser(u: SupabaseUser): UserProfile {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: u.id,
    email: u.email ?? '',
    nickname: (meta.nickname as string) ?? '',
    avatar: (meta.avatar as string) ?? '',
    bio: (meta.bio as string) ?? '',
    is_admin: Boolean(meta.is_admin),
    is_vip: Boolean(meta.is_vip),
    vip_started_at: (meta.vip_started_at as string) ?? null,
    vip_expired_at: (meta.vip_expired_at as string) ?? null,
    is_banned: Boolean(meta.is_banned),
    post_count: Number(meta.post_count ?? 0),
    comment_count: Number(meta.comment_count ?? 0),
    created_at: (meta.created_at as string) ?? '',
    // 积分相关字段（user_metadata 通常不含，Navbar 通过 /api/auth/profile 单独拉取最新值）
    points: Number(meta.points ?? 0),
    total_earned_points: Number(meta.total_earned_points ?? 0),
    invite_code: (meta.invite_code as string) ?? null,
    invited_by: (meta.invited_by as string) ?? null,
    invite_count: Number(meta.invite_count ?? 0),
  };
}

/**
 * 全局顶部导航栏（fixed top-0）
 * 监听 Supabase auth 状态变化，自适应登录态
 */
export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // 当前用户积分余额（独立于 user_metadata，需通过 API 拉取）
  const [points, setPoints] = useState<number | null>(null);

  // 登录成功后从服务端拉取最新积分余额（user_metadata 不含积分字段）
  async function fetchPoints() {
    try {
      const res = await fetch('/api/auth/profile', { credentials: 'same-origin' });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setPoints(Number(json.data.points ?? 0));
      }
    } catch {
      // 静默失败，不打扰用户
    }
  }

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    // 初始化：获取当前会话
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(mapUser(data.session.user));
        // 拉取最新积分余额
        fetchPoints();
      }
      setLoading(false);
    });

    // 监听后续状态变化
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(mapUser(session.user));
        // 登录/会话恢复时刷新积分
        fetchPoints();
      } else {
        setUser(null);
        setPoints(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 路由变化时刷新积分余额（发帖/解锁/被邀请后能即时反映）
  useEffect(() => {
    if (!user) return;
    fetchPoints();
  }, [pathname, user]);

  // 退出登录
  async function handleLogout() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    setUser(null);
    setUserMenuOpen(false);
    setMenuOpen(false);
    router.push('/');
  }

  // 过滤可见导航项（管理员后台仅管理员可见，邀请好友仅登录用户可见）
  const visibleNavItems = NAV_ITEMS.filter(
    (item) =>
      (!item.adminOnly || user?.is_admin) &&
      (!item.authOnly || user)
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-border bg-bg-base/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        {/* 左侧 Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-600/30">
            <Sparkles className="text-white" size={18} />
          </div>
          <span className="text-lg font-bold text-text-primary">软件/影视网盘资源分享论坛</span>
        </Link>

        {/* 中间导航 - 桌面端 */}
        <nav className="hidden items-center gap-6 md:flex">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-primary-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 右侧用户区 - 桌面端 */}
        <div className="hidden items-center gap-3 md:flex">
          {!user && !loading ? (
            <Link href="/login" className="btn-primary">
              登录
            </Link>
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-bg-hover"
              >
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar}
                    alt={user.nickname}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-500/20 text-primary-300">
                    <User size={16} />
                  </div>
                )}
                <span className="max-w-[6rem] truncate text-sm text-text-primary">
                  {user.nickname || user.email}
                </span>
                {/* 积分徽章 */}
                {points !== null && (
                  <span className="flex items-center gap-0.5 rounded-full bg-purple-500/15 px-2 py-0.5 text-xs text-purple-300">
                    <Coins size={10} />
                    {points}
                  </span>
                )}
                <ChevronDown className="text-text-muted" size={14} />
              </button>

              {userMenuOpen && (
                <>
                  {/* 点击外部关闭 */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-xl">
                    {/* 积分概览（顶部） */}
                    {points !== null && (
                      <div className="flex items-center justify-between border-b border-border bg-purple-500/5 px-3 py-2.5">
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                          <Coins size={12} className="text-purple-300" />
                          我的积分
                        </span>
                        <span className="text-sm font-bold text-purple-300">{points}</span>
                      </div>
                    )}
                    <Link
                      href="/invite"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                    >
                      <UserPlus size={14} />
                      邀请好友
                    </Link>
                    <Link
                      href={`/user/${user.id}?tab=points`}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                    >
                      <Coins size={14} />
                      积分中心
                    </Link>
                    <Link
                      href={`/user/${user.id}`}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                    >
                      <User size={14} />
                      个人中心
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger transition-colors hover:bg-bg-hover"
                    >
                      <LogOut size={14} />
                      退出登录
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* 移动端汉堡按钮 */}
        <button
          className="text-text-secondary md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="菜单"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* 移动端展开菜单 */}
      {menuOpen && (
        <div className="border-t border-border bg-bg-surface md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-border" />
            {!user ? (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-primary-300 transition-colors hover:bg-bg-hover"
              >
                登录
              </Link>
            ) : (
              <>
                {points !== null && (
                  <div className="flex items-center justify-between rounded-lg bg-purple-500/10 px-3 py-2 text-sm">
                    <span className="flex items-center gap-1 text-text-muted">
                      <Coins size={14} className="text-purple-300" />
                      我的积分
                    </span>
                    <span className="font-bold text-purple-300">{points}</span>
                  </div>
                )}
                <Link
                  href="/invite"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                >
                  <UserPlus size={14} />
                  邀请好友
                </Link>
                <Link
                  href={`/user/${user.id}?tab=points`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                >
                  <Coins size={14} />
                  积分中心
                </Link>
                <Link
                  href={`/user/${user.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
                >
                  <User size={14} />
                  个人中心
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-bg-hover"
                >
                  <LogOut size={14} />
                  退出登录
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
