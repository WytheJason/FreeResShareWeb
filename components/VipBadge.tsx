import { Crown } from 'lucide-react';
import type { UserProfile } from '@/lib/types';

interface VipBadgeProps {
  /** 用户资料，未登录或非 VIP 时返回 null */
  user?: UserProfile | null;
  /** 尺寸：sm 更小，md 默认 */
  size?: 'sm' | 'md';
}

/**
 * 判断 VIP 是否在有效期内
 * - is_vip 必须为 true
 * - vip_expired_at 必须存在且未过期
 */
function isVipActive(user: UserProfile): boolean {
  if (!user.is_vip) return false;
  if (!user.vip_expired_at) return false;
  const expired = new Date(user.vip_expired_at).getTime();
  if (isNaN(expired)) return false;
  return expired > Date.now();
}

/**
 * VIP 徽章组件
 * 仅当用户为 VIP 且在有效期内显示金色 Crown + "VIP" 文字
 * 过期 VIP 不显示
 */
export default function VipBadge({ user, size = 'md' }: VipBadgeProps) {
  if (!user || !isVipActive(user)) return null;

  const sizeCls =
    size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5';
  const iconSize = size === 'sm' ? 10 : 12;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-gold-500/30 bg-gold-500/15 font-semibold text-gold-300 ${sizeCls}`}
    >
      <Crown size={iconSize} />
      VIP
    </span>
  );
}
