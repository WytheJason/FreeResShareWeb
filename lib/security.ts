/**
 * 安全工具集
 * - XSS 转义
 * - 敏感词过滤
 * - 网盘链接校验
 * - 链接脱敏
 * - 防抖锁（重复提交拦截）
 */

import type { PanType } from './types';

// ============ 1. XSS 转义 ============

/**
 * HTML 实体转义，防止 XSS 注入
 * 在内容入库前调用
 */
export function escapeHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 清理富文本中的危险标签与脚本
 * 保留普通文本与基本换行
 */
export function sanitizeContent(input: string): string {
  if (!input) return '';
  // 先移除 script/iframe/style 标签及其内容
  let text = input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '');
  // 再做实体转义
  text = escapeHtml(text);
  // 保留换行
  return text;
}

// ============ 2. 敏感词过滤 ============

/**
 * 内置敏感词库（示例，生产可扩展）
 * 命中后替换为 *
 */
const SENSITIVE_WORDS: string[] = [
  'fuck', 'shit', 'bitch',
  '操你', '草泥马', '傻逼', '弱智',
  '色情', '成人电影', '裸体',
  '赌博', '博彩', '六合彩',
  '诈骗', '传销',
  '反动', '政治敏感',
];

/**
 * 敏感词过滤，命中替换为等长星号
 */
export function filterSensitiveWords(input: string): string {
  if (!input) return '';
  let result = input;
  for (const word of SENSITIVE_WORDS) {
    if (result.toLowerCase().includes(word.toLowerCase())) {
      const replacement = '*'.repeat(word.length);
      // 全局不区分大小写替换
      const regex = new RegExp(escapeRegExp(word), 'gi');
      result = result.replace(regex, replacement);
    }
  }
  return result;
}

/**
 * 转义正则特殊字符
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============ 3. 网盘链接校验 ============

/**
 * 网盘链接正则规则
 */
const PAN_URL_PATTERNS: Record<PanType, RegExp> = {
  baidu: /^https?:\/\/pan\.baidu\.com\/s\/[\w-]+/i,
  aliyun: /^https?:\/\/www\.alipan\.com\/s\/[\w-]+|^https?:\/\/www\.aliyundrive\.com\/s\/[\w-]+/i,
  quark: /^https?:\/\/pan\.quark\.cn\/s\/[\w]+/i,
};

/**
 * 校验网盘链接格式是否合法
 */
export function isValidPanUrl(panType: PanType, url: string): boolean {
  if (!url) return false;
  const pattern = PAN_URL_PATTERNS[panType];
  return pattern.test(url.trim());
}

/**
 * 检测文本中是否包含恶意外链
 * 仅允许常见网盘域名，其他链接视为可疑
 */
export function containsMaliciousLink(text: string): boolean {
  if (!text) return false;
  // 提取所有 URL
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return false;

  const allowedDomains = [
    'pan.baidu.com', 'pan.baidupcs.com',
    'alipan.com', 'aliyundrive.com',
    'pan.quark.cn',
    'www.lanzoui.com', 'www.lanzoux.com', 'www.lanzouw.com', 'www.lanzoup.com', 'www.lanzout.com', 'www.lanzoue.com', 'www.lanzouy.com',
    'cloud.189.cn',
    'drive.uc.cn',
  ];

  for (const url of matches) {
    let isAllowed = false;
    for (const domain of allowedDomains) {
      if (url.toLowerCase().includes(domain)) {
        isAllowed = true;
        break;
      }
    }
    if (!isAllowed) {
      return true;
    }
  }
  return false;
}

// ============ 4. 链接脱敏 ============

/**
 * 网盘链接脱敏展示
 * 例：https://pan.baidu.com/s/abcdefg123 → https://pan.baidu.com/s/a****23
 * 防止爬虫批量采集
 */
export function maskPanUrl(url: string): string {
  if (!url) return '';
  // 提取末尾路径段
  const match = url.match(/^(https?:\/\/[^/]+\/[^/]+\/)([A-Za-z0-9_-]+)(.*)?$/);
  if (!match) return url;

  const [, prefix, code, suffix = ''] = match;
  if (code.length <= 4) {
    return `${prefix}${'*'.repeat(code.length)}${suffix}`;
  }
  // 保留前 1 位 + 后 2 位，中间替换为 ****
  const masked = code[0] + '****' + code.slice(-2);
  return `${prefix}${masked}${suffix}`;
}

/**
 * 提取码脱敏（直接隐藏，前端不展示明文）
 */
export function maskPanCode(): string {
  return '****';
}

// ============ 5. 防抖锁（重复提交拦截）============

/**
 * 进程内防抖锁存储
 * key = `${userId|ip}:${action}`
 * value = 过期时间戳
 *
 * 注意：Vercel Serverless 函数实例可能不共享内存
 * 在多实例场景下，重复提交拦截可能不完全准确
 * 如需强一致，可改用 Upstash Redis 等外部存储
 */
const submitLocks = new Map<string, number>();

/**
 * 默认锁时长 5 秒
 */
const DEFAULT_LOCK_TTL = 5 * 1000;

/**
 * 尝试获取提交锁
 * @returns true=获取成功（允许提交），false=已被锁定（重复提交）
 */
export function acquireSubmitLock(key: string, ttlMs: number = DEFAULT_LOCK_TTL): boolean {
  const now = Date.now();
  const expiredAt = submitLocks.get(key);

  if (expiredAt && expiredAt > now) {
    // 锁未过期，重复提交
    return false;
  }

  // 设置新锁
  submitLocks.set(key, now + ttlMs);
  return true;
}

/**
 * 释放提交锁（业务异常回滚时调用）
 */
export function releaseSubmitLock(key: string): void {
  submitLocks.delete(key);
}

/**
 * 生成提交锁 key
 */
export function buildLockKey(identity: string, action: string): string {
  return `${identity}:${action}`;
}

// ============ 6. 综合内容处理 ============

/**
 * 综合处理文本内容：XSS 清理 + 敏感词过滤
 * 用于帖子标题/简介/评论内容入库前
 */
export function sanitizeUserContent(input: string): string {
  return filterSensitiveWords(sanitizeContent(input));
}

/**
 * 判断评论内容是否为空或纯符号
 */
export function isEmptyOrSymbolOnly(input: string): boolean {
  if (!input) return true;
  // 去除所有空白与常见符号
  const cleaned = input.replace(/[\s\p{P}\p{S}~`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/gu, '');
  return cleaned.length === 0;
}
