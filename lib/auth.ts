/**
 * 权限工具
 * - 获取当前登录用户
 * - 判定用户角色
 * - VIP 时效校验
 */

import { getSupabaseServer, getSupabaseServiceAdmin } from './supabase-server';
import type { UserRole, UserProfile } from './types';

// ============ 用户与会话 ============

/**
 * 获取当前登录用户的 user_profile 记录
 * 未登录返回 null
 *
 * 重要：
 * - auth.getUser() 用绑定会话的 supabase 客户端验证 token（需要 cookie）
 * - user_profile 查询改用 admin 绕过 RLS，因为 auth.getUser() 已验证身份
 *   RLS 策略可能因配置问题阻止读取，导致已登录用户被判为未登录
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // 使用 admin 绕过 RLS 查询 user_profile
    // auth.getUser() 已验证用户身份，此处仅读取附加资料
    const admin = getSupabaseServiceAdmin();
    const { data: profile } = await admin
      .from('user_profile')
      .select('*')
      .eq('id', user.id)
      .single();

    return profile as UserProfile | null;
  } catch (error) {
    console.error('[Auth] 获取当前用户失败', error);
    return null;
  }
}

/**
 * 判定用户角色
 */
export function getUserRole(user: UserProfile | null): UserRole {
  if (!user) return 'guest';
  if (user.is_banned) return 'guest'; // 封禁用户视同游客
  if (user.is_admin) return 'admin';
  if (isVipActive(user)) return 'vip';
  return 'user';
}

// ============ VIP 时效校验 ============

/**
 * 判定用户 VIP 是否在有效期内
 */
export function isVipActive(user: UserProfile | null): boolean {
  if (!user) return false;
  if (!user.is_vip) return false;
  if (!user.vip_expired_at) return false;

  const expiredAt = new Date(user.vip_expired_at).getTime();
  const now = Date.now();

  return expiredAt > now;
}

/**
 * 获取 VIP 剩余天数（向上取整）
 * 已过期或无 VIP 返回 0
 */
export function getVipRemainingDays(user: UserProfile | null): number {
  if (!user || !isVipActive(user)) return 0;
  const expiredAt = new Date(user.vip_expired_at!).getTime();
  const now = Date.now();
  const diffMs = expiredAt - now;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * 检查并自动降级过期 VIP（按需调用）
 * 在用户访问受保护资源时检查
 */
export async function checkAndDowngradeExpiredVip(user: UserProfile): Promise<UserProfile> {
  if (!user.is_vip) return user;
  if (isVipActive(user)) return user;

  // VIP 已过期，自动降级
  try {
    const admin = getSupabaseServiceAdmin();
    await admin
      .from('user_profile')
      .update({
        is_vip: false,
        // 保留 vip_expired_at 用于历史记录查询
      })
      .eq('id', user.id);

    return { ...user, is_vip: false };
  } catch (error) {
    console.error('[Auth] VIP 自动降级失败', error);
    return user;
  }
}

// ============ 权限检查 ============

/**
 * 检查用户是否可发布内容（发帖/评论）
 * - 必须登录
 * - 不能被封禁
 */
export function canPublish(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.is_banned) return false;
  return true;
}

/**
 * 检查用户是否可查看 VIP 加密资源
 * - VIP 会员（在有效期内）
 * - 管理员
 * - 帖子作者
 */
export function canViewVipResource(
  user: UserProfile | null,
  postAuthorId: string
): boolean {
  if (!user) return false;
  if (user.id === postAuthorId) return true;
  if (user.is_admin) return true;
  return isVipActive(user);
}

/**
 * 检查用户是否可查看公开资源完整链接
 * - 任何登录用户（非封禁）
 * - 游客不可见
 */
export function canViewPublicResource(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.is_banned) return false;
  return true;
}

/**
 * 检查用户是否为管理员
 */
export function isAdmin(user: UserProfile | null): boolean {
  return !!user?.is_admin;
}
