/**
 * IP 限流工具
 *
 * 基于 Vercel 内存实现的简单限流
 * 单 IP 单窗口期内限制请求次数，抵御 CC 刷接口
 *
 * 注意：Vercel Serverless 多实例场景下，内存限流可能不完全准确
 * 如需严格限流，建议升级为 Upstash Redis + sliding window 算法
 * 当前实现已足以应对 hobby 套餐下的常规防刷
 */

// ============ 限流配置 ============

/** 默认窗口期 60 秒 */
const DEFAULT_WINDOW_MS = 60 * 1000;

/** 默认窗口期内最大请求数 */
const DEFAULT_MAX_REQUESTS = 60;

// ============ 限流存储 ============

interface RateLimitRecord {
  /** 窗口起始时间 */
  windowStart: number;
  /** 当前窗口内请求数 */
  count: number;
}

/**
 * 进程内限流存储
 * key = `${ip}:${route}`
 */
const rateLimitStore = new Map<string, RateLimitRecord>();

// ============ 限流核心 ============

export interface RateLimitOptions {
  /** 窗口期毫秒数 */
  windowMs?: number;
  /** 窗口期内最大请求数 */
  maxRequests?: number;
}

export interface RateLimitResult {
  /** 是否允许通过 */
  allowed: boolean;
  /** 当前窗口已用次数 */
  current: number;
  /** 窗口上限 */
  limit: number;
  /** 距离窗口重置的剩余毫秒 */
  resetInMs: number;
}

/**
 * 检查 IP 限流
 * @param ip 客户端 IP
 * @param route 路由标识（用于区分不同接口的限流）
 * @param options 限流参数
 */
export function checkRateLimit(
  ip: string,
  route: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;

  const key = `${ip}:${route}`;
  const now = Date.now();

  const record = rateLimitStore.get(key);

  // 无记录或窗口已过期，新建窗口
  if (!record || now - record.windowStart >= windowMs) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return {
      allowed: true,
      current: 1,
      limit: maxRequests,
      resetInMs: windowMs,
    };
  }

  // 窗口内累加
  record.count += 1;
  const resetInMs = windowMs - (now - record.windowStart);

  if (record.count > maxRequests) {
    return {
      allowed: false,
      current: record.count,
      limit: maxRequests,
      resetInMs: Math.max(resetInMs, 0),
    };
  }

  return {
    allowed: true,
    current: record.count,
    limit: maxRequests,
    resetInMs: Math.max(resetInMs, 0),
  };
}

/**
 * 从请求头获取客户端真实 IP
 * Vercel 部署下，真实 IP 在 x-forwarded-for 或 x-real-ip 头中
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;

  // Vercel 优先级：x-forwarded-for > x-real-ip > cf-connecting-ip
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    // x-forwarded-for 可能是 "client, proxy1, proxy2" 格式，取第一个
    return xff.split(',')[0].trim();
  }

  const xri = headers.get('x-real-ip');
  if (xri) return xri.trim();

  const cfip = headers.get('cf-connecting-ip');
  if (cfip) return cfip.trim();

  return 'unknown';
}

/**
 * 定期清理过期限流记录，避免内存泄漏
 * 每次调用检查并清理 100 条以上的过期记录
 */
export function cleanupRateLimitStore(): void {
  if (rateLimitStore.size < 500) return;

  const now = Date.now();
  const defaultWindow = DEFAULT_WINDOW_MS;

  for (const [key, record] of rateLimitStore) {
    if (now - record.windowStart >= defaultWindow * 2) {
      rateLimitStore.delete(key);
    }
  }
}
