/**
 * 通用工具函数
 * - 日期格式化
 * - 注册时长计算
 * - 热度计算
 * - 分页计算
 * - 字符串截断
 */

import type { Post } from './types';

// ============ 1. 日期格式化 ============

/**
 * 格式化日期为 "YYYY-MM-DD HH:mm"
 */
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/**
 * 格式化相对时间（"刚刚"、"3 分钟前"、"2 小时前"、"3 天前"）
 */
export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = Date.now();
  const diff = now - date.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < week) return `${Math.floor(diff / day)} 天前`;
  if (diff < month) return `${Math.floor(diff / week)} 周前`;
  return formatDateTime(dateStr);
}

/**
 * 计算注册时长（"3 天"、"2 个月"、"1 年"）
 */
export function formatRegisterDuration(createdAt: string): string {
  if (!createdAt) return '';
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return '';

  const now = Date.now();
  const diff = now - created.getTime();

  const day = 24 * 60 * 60 * 1000;
  const month = 30 * day;
  const year = 365 * day;

  if (diff < day) return '今日加入';
  if (diff < month) return `${Math.floor(diff / day)} 天`;
  if (diff < year) return `${Math.floor(diff / month)} 个月`;
  return `${Math.floor(diff / year)} 年`;
}

// ============ 2. 热度计算 ============

/**
 * 计算帖子热度值
 * 公式：hot_weight * 10 + view_count + comment_count * 5
 * hot_weight 为管理员设置的基础权重
 */
export function calculateHotScore(post: Pick<Post, 'hot_weight' | 'view_count' | 'comment_count'>): number {
  return (post.hot_weight ?? 0) * 10 + (post.view_count ?? 0) + (post.comment_count ?? 0) * 5;
}

// ============ 3. 分页计算 ============

/**
 * 计算分页起止位置
 */
export function calcPageRange(page: number, pageSize: number): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, Math.min(100, pageSize));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  return { from, to };
}

/**
 * 计算总页数
 */
export function calcTotalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 0;
  return Math.ceil(total / pageSize);
}

// ============ 4. 字符串处理 ============

/**
 * 安全截断字符串（避免中文字符截断问题）
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * 提取文本摘要（去除 HTML 标签 + 截断）
 */
export function extractExcerpt(html: string, maxLength: number = 100): string {
  if (!html) return '';
  const text = html.replace(/<[^>]+>/g, '');
  return truncateText(text, maxLength);
}

// ============ 5. 验证工具 ============

/**
 * 邮箱格式校验
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

/**
 * 密码强度校验
 * 要求：8-32 位，必须包含字母与数字
 */
export function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (!password) return { valid: false, message: '密码不能为空' };
  if (password.length < 8) return { valid: false, message: '密码至少 8 位' };
  if (password.length > 32) return { valid: false, message: '密码最多 32 位' };
  if (!/[a-zA-Z]/.test(password)) return { valid: false, message: '密码必须包含字母' };
  if (!/\d/.test(password)) return { valid: false, message: '密码必须包含数字' };
  return { valid: true };
}

/**
 * 昵称校验（1-20 位，允许中英文数字下划线）
 */
export function isValidNickname(nickname: string): boolean {
  if (!nickname) return false;
  return /^[a-zA-Z0-9_\u4e00-\u9fa5]{1,20}$/.test(nickname);
}

/**
 * 提取码校验（0-8 位字母数字）
 */
export function isValidPanCode(code: string): boolean {
  if (!code) return true; // 提取码可选
  return /^[a-zA-Z0-9]{0,8}$/.test(code.trim());
}

// ============ 6. 响应工具 ============

/**
 * 构造成功响应
 */
export function successResponse<T>(data: T, message: string = '操作成功') {
  return {
    code: 0,
    message,
    data,
  };
}

/**
 * 构造失败响应
 */
export function errorResponse(message: string, code: number = 1) {
  return {
    code,
    message,
  };
}

/**
 * HTTP 状态码映射
 */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const;
