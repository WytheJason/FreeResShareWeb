/**
 * VIP 专区页（服务端组件）
 * - Hero 区：金色渐变背景 + Crown 图标
 * - 当前用户状态卡
 * - VIP 权益卡片网格
 * - 在线购买套餐（VipPurchaseClient 客户端组件）
 */
import { Suspense } from 'react';
import Link from 'next/link';
import {
  Crown,
  Lock,
  Headphones,
  Zap,
  ShieldCheck,
  Star,
  Sparkles,
} from 'lucide-react';
import { getCurrentUser, isVipActive, getVipRemainingDays } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';
import VipBadge from '@/components/VipBadge';
import VipPurchaseClient from './VipPurchaseClient';
import { Spinner } from '@/components/Loading';
import type { ReactNode } from 'react';

// ============ 权益项配置 ============

interface BenefitItem {
  icon: ReactNode;
  title: string;
  desc: string;
}

const BENEFITS: BenefitItem[] = [
  {
    icon: <Lock size={20} />,
    title: '解锁全部加密资源',
    desc: '无需邀请码，直接查看所有 VIP 加密资源的完整网盘链接与提取码。',
  },
  {
    icon: <Crown size={20} />,
    title: '金色专属徽章',
    desc: '在昵称旁展示金色 Crown 徽章，彰显会员身份，社区互动更显尊贵。',
  },
  {
    icon: <Headphones size={20} />,
    title: '优先客服支持',
    desc: '一对一专属客服通道，问题反馈与资源请求优先响应处理。',
  },
  {
    icon: <Zap size={20} />,
    title: '高速下载通道',
    desc: '专属加速节点保障网盘资源下载速度，告别卡顿与限速。',
  },
  {
    icon: <ShieldCheck size={20} />,
    title: '无广告浏览',
    desc: '全站无广告打扰，纯净浏览体验，专注资源获取本身。',
  },
  {
    icon: <Star size={20} />,
    title: '专属资源推荐',
    desc: '基于偏好推荐的精选内容，第一时间获取优质稀缺资源。',
  },
];

// ============ 主页面 ============

export default async function VipPage() {
  const user = await getCurrentUser();
  const isActive = isVipActive(user);
  const remainingDays = getVipRemainingDays(user);

  return (
    <div className="space-y-8 fade-in">
      {/* ============ Hero 区 ============ */}
      <section className="relative overflow-hidden rounded-2xl border border-gold-500/20 bg-gradient-to-br from-gold-500/20 via-bg-base to-bg-base px-6 py-10 md:px-10 md:py-14">
        {/* 装饰光斑 */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-gold-700/10 blur-3xl" />

        <div className="relative max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs text-gold-300">
            <Sparkles size={12} />
            VIP 会员专属
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/30">
              <Crown className="text-bg-base" size={26} />
            </div>
            <h1 className="text-3xl font-bold leading-tight text-text-primary md:text-4xl">
              VIP 会员专区
            </h1>
          </div>
          <p className="mt-3 text-sm leading-7 text-text-muted md:text-base">
            升级 VIP 会员，解锁加密资源、专属徽章、优先客服、高速下载等
            六大权益，畅享尊贵资源分享体验。
          </p>
        </div>
      </section>

      {/* ============ 当前用户状态卡 ============ */}
      <section>
        {!user ? (
          <div className="card flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-bg-elevated text-text-muted">
                <Crown size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">登录后查看会员状态</p>
                <p className="text-xs text-text-muted">登录账号即可查看您的 VIP 会员权益</p>
              </div>
            </div>
            <Link href="/login?redirect=/vip" className="btn-gold">
              <Crown size={14} />
              立即登录
            </Link>
          </div>
        ) : isActive ? (
          <div className="card-gold flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-bg-base shadow-lg shadow-gold-500/30">
                <Crown size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">
                    尊贵的 VIP 会员
                  </p>
                  <VipBadge user={user} size="sm" />
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  到期时间：{formatDateTime(user.vip_expired_at ?? '')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 px-4 py-2">
              <Sparkles size={14} className="text-gold-300" />
              <span className="text-sm font-semibold text-gold-300">
                剩余 {remainingDays} 天
              </span>
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-bg-elevated text-text-muted">
                <Crown size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {user.is_vip ? '您的 VIP 已过期' : '您当前是普通用户'}
                </p>
                <p className="text-xs text-text-muted">
                  {user.is_vip && user.vip_expired_at
                    ? `过期时间：${formatDateTime(user.vip_expired_at)}，续费即可恢复权益`
                    : '开通 VIP 解锁全部加密资源与专属权益'}
                </p>
              </div>
            </div>
            <a href="#open-vip" className="btn-gold">
              <Crown size={14} />
              {user.is_vip ? '立即续费' : '立即开通'}
            </a>
          </div>
        )}
      </section>

      {/* ============ VIP 权益卡片网格 ============ */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-gold-400" />
          <h2 className="section-title text-lg">VIP 专属权益</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="card group p-5 transition-colors hover:border-gold-500/40"
            >
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-gold-500/15 to-gold-700/10 text-gold-400 transition-transform group-hover:scale-105">
                {b.icon}
              </div>
              <h3 className="text-sm font-semibold text-text-primary">
                {b.title}
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-text-muted">
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 在线购买套餐 ============ */}
      <section id="open-vip" className="scroll-mt-24">
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          }
        >
          <VipPurchaseClient
            isLoggedIn={!!user}
            vipActive={isActive}
            vipExpiredAt={user?.vip_expired_at ?? null}
            inviteCount={user?.invite_count ?? 0}
          />
        </Suspense>
      </section>
    </div>
  );
}
