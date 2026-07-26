'use client';

/**
 * 管理员数据看板
 * - 4 个总量统计卡片（用户/帖子/评论/VIP）
 * - 4 个今日新增卡片（用户/帖子/评论/待处理举报）
 * - 侧边导航跳转其他后台页面
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FileText,
  MessageCircle,
  Crown,
  RefreshCw,
  UserPlus,
  FilePlus2,
  MessageSquare,
  AlertTriangle,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';
import type { AdminStats } from '@/lib/types';
import { useToast } from '@/components/Toast';

// 数字卡片配置
interface StatCard {
  label: string;
  value: number;
  icon: typeof Users;
  color: string;
  glow?: boolean;
}

// 今日新增卡片配置
interface TodayCard {
  label: string;
  value: number;
  icon: typeof UserPlus;
  href?: string;
  color: string;
}

export default function AdminDashboardPage() {
  const toast = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 拉取统计数据
  const fetchStats = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/admin/stats', { cache: 'no-store' });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setStats(json.data);
      } else {
        toast.show('error', json.message ?? '加载失败');
      }
    } catch {
      toast.show('error', '网络异常，加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 总量卡片
  const totalCards: StatCard[] = stats
    ? [
        { label: '总用户数', value: stats.total_users, icon: Users, color: 'text-primary-400' },
        { label: '总帖子数', value: stats.total_posts, icon: FileText, color: 'text-purple-400' },
        { label: '总评论数', value: stats.total_comments, icon: MessageCircle, color: 'text-success' },
        { label: 'VIP 人数', value: stats.total_vip, icon: Crown, color: 'text-gold-400', glow: true },
      ]
    : [];

  // 今日卡片
  const todayCards: TodayCard[] = stats
    ? [
        { label: '今日新增用户', value: stats.today_new_users, icon: UserPlus, color: 'text-primary-400' },
        { label: '今日新增帖子', value: stats.today_new_posts, icon: FilePlus2, color: 'text-purple-400' },
        { label: '今日新增评论', value: stats.today_new_comments, icon: MessageSquare, color: 'text-success' },
        {
          label: '待处理举报',
          value: stats.pending_reports,
          icon: AlertTriangle,
          href: '/admin/reports',
          color: 'text-danger',
        },
      ]
    : [];

  return (
    <div className="space-y-6 fade-in">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="text-primary-400" size={24} />
          <h1 className="section-title">数据看板</h1>
        </div>
        <button
          className="btn-secondary"
          onClick={fetchStats}
          disabled={refreshing}
          aria-label="刷新"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {/* 总量统计卡片 */}
      <section>
        <h2 className="mb-3 text-sm text-text-muted">总量统计</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {loading || !stats
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-6">
                  <div className="skeleton h-12 w-3/4 rounded" />
                  <div className="skeleton mt-3 h-3 w-1/2 rounded" />
                </div>
              ))
            : totalCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className={`card relative p-6 ${card.glow ? 'vip-glow' : ''}`}
                  >
                    <Icon
                      className={`absolute right-4 top-4 ${card.color}`}
                      size={20}
                    />
                    <div className="text-3xl font-bold text-text-primary">
                      {card.value.toLocaleString()}
                    </div>
                    <div className="mt-2 text-sm text-text-muted">{card.label}</div>
                  </div>
                );
              })}
        </div>
      </section>

      {/* 今日新增卡片 */}
      <section>
        <h2 className="mb-3 text-sm text-text-muted">今日新增</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {loading || !stats
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-6">
                  <div className="skeleton h-12 w-3/4 rounded" />
                  <div className="skeleton mt-3 h-3 w-1/2 rounded" />
                </div>
              ))
            : todayCards.map((card) => {
                const Icon = card.icon;
                const inner = (
                  <div className="card relative p-6 transition-colors hover:border-primary-500/50">
                    <Icon
                      className={`absolute right-4 top-4 ${card.color}`}
                      size={18}
                    />
                    <div className="text-3xl font-bold text-text-primary">
                      {card.value.toLocaleString()}
                    </div>
                    <div className="mt-2 text-sm text-text-muted">{card.label}</div>
                  </div>
                );
                return card.href ? (
                  <Link key={card.label} href={card.href} className="block">
                    {inner}
                  </Link>
                ) : (
                  <div key={card.label}>{inner}</div>
                );
              })}
        </div>
      </section>

      {/* 侧边快捷导航 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm text-text-muted">
          <ShieldCheck size={14} />
          管理导航
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/admin/users" className="btn-secondary">
            <Users size={14} />
            用户管理
          </Link>
          <Link href="/admin/posts" className="btn-secondary">
            <FileText size={14} />
            帖子管理
          </Link>
          <Link href="/admin/comments" className="btn-secondary">
            <MessageCircle size={14} />
            评论管理
          </Link>
          <Link href="/admin/reports" className="btn-secondary">
            <AlertTriangle size={14} />
            举报管理
          </Link>
        </div>
      </section>
    </div>
  );
}
