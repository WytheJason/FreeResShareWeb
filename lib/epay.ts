/**
 * 易支付（EPay）工具函数
 * - 构造支付跳转 URL
 * - 签名生成与验签
 * - 订单号生成
 *
 * 易支付标准协议（彩虹易支付/通用聚合支付）：
 * 1. 构造参数 → MD5 签名 → 拼接成跳转 URL
 * 2. 用户在易支付页面完成支付
 * 3. 支付完成后易支付异步 POST 通知本站 notify_url
 * 4. 本站验签后更新订单状态
 *
 * 环境变量：
 * - EPAY_PID        商户ID
 * - EPAY_KEY        商户密钥
 * - EPAY_API_URL    易支付网关地址（如 https://pay.example.com）
 * - NEXT_PUBLIC_SITE_URL  站点URL（用于回调地址）
 */

import crypto from 'crypto';

// ============ 配置读取 ============

/** 获取易支付配置 */
function getEpayConfig() {
  const pid = process.env.EPAY_PID;
  const key = process.env.EPAY_KEY;
  const apiUrl = process.env.EPAY_API_URL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://web.bestbzw.xyz';

  if (!pid || !key || !apiUrl) {
    throw new Error('[EPay] 缺少环境变量：EPAY_PID / EPAY_KEY / EPAY_API_URL');
  }

  return { pid, key, apiUrl, siteUrl };
}

/** 检查易支付是否已配置（不抛错，返回布尔值） */
export function isEpayConfigured(): boolean {
  return !!(process.env.EPAY_PID && process.env.EPAY_KEY && process.env.EPAY_API_URL);
}

// ============ 签名 ============

/**
 * 易支付签名算法
 * 1. 过滤空值参数和 sign/sign_type 参数
 * 2. 按键名 ASCII 升序排序
 * 3. 拼接成 key1=value1&key2=value2 格式（不进行 URL 编码）
 * 4. 末尾拼接商户密钥
 * 5. MD5 取小写
 */
export function generateSign(params: Record<string, string | number | undefined>, key: string): string {
  // 过滤空值和 sign 相关字段
  const filtered = Object.entries(params)
    .filter(([k, v]) => {
      if (k === 'sign' || k === 'sign_type') return false;
      return v !== undefined && v !== null && v !== '';
    })
    .sort(([a], [b]) => a.localeCompare(b));

  // 拼接
  const query = filtered.map(([k, v]) => `${k}=${v}`).join('&');
  const signStr = query + key;

  // MD5
  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex');
}

/**
 * 验证回调签名
 * @param params 易支付回调的参数（含 sign）
 * @param key 商户密钥
 * @returns 签名是否匹配
 */
export function verifySign(params: Record<string, string>, key: string): boolean {
  const receivedSign = params.sign;
  if (!receivedSign) return false;

  const computedSign = generateSign(params, key);
  return computedSign === receivedSign.toLowerCase();
}

// ============ 订单号 ============

/**
 * 生成唯一订单号
 * 格式：VIP + 年月日时分秒 + 6位随机
 * 示例：VIP20260802143025A1B2C3
 */
export function generateOrderNo(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VIP${yyyy}${mm}${dd}${hh}${mi}${ss}${random}`;
}

// ============ 支付方式 ============

export type EpayPayType = 'alipay' | 'wxpay' | 'qqpay';

/** 支付方式标签 */
export const PAY_TYPE_LABELS: Record<EpayPayType, string> = {
  alipay: '支付宝',
  wxpay: '微信支付',
  qqpay: 'QQ钱包',
};

// ============ 构造支付 URL ============

export interface CreatePaymentParams {
  /** 商户订单号 */
  outTradeNo: string;
  /** 商品名称 */
  name: string;
  /** 金额（元） */
  money: number;
  /** 支付方式 */
  payType: EpayPayType;
  /** 异步通知地址 */
  notifyUrl: string;
  /** 同步跳转地址 */
  returnUrl: string;
}

export interface CreatePaymentResult {
  /** 完整支付跳转 URL */
  payUrl: string;
  /** 订单号 */
  orderNo: string;
}

/**
 * 构造易支付跳转 URL
 * 使用「跳转支付」模式（submit.php），用户跳转到易支付页面选择支付方式
 */
export function createPaymentUrl(params: CreatePaymentParams): CreatePaymentResult {
  const { pid, key, apiUrl } = getEpayConfig();

  const signParams: Record<string, string | number> = {
    pid,
    type: params.payType,
    out_trade_no: params.outTradeNo,
    notify_url: params.notifyUrl,
    return_url: params.returnUrl,
    name: params.name,
    money: params.money.toFixed(2),
  };

  const sign = generateSign(signParams, key);

  const query = new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(signParams).map(([k, v]) => [k, String(v)])
    ),
    sign,
    sign_type: 'MD5',
  });

  // submit.php 为易支付标准跳转支付接口
  const payUrl = `${apiUrl.replace(/\/$/, '')}/submit.php?${query.toString()}`;

  return {
    payUrl,
    orderNo: params.outTradeNo,
  };
}

// ============ 回调处理 ============

/**
 * 解析并验证易支付异步通知
 * @param body 易支付 POST 过来的表单数据
 * @returns 验证通过返回订单信息，失败返回 null
 */
export function parseNotify(body: Record<string, string>): {
  orderNo: string;
  tradeNo: string;
  money: string;
  payType: string;
} | null {
  const { key } = getEpayConfig();

  // 验签
  if (!verifySign(body, key)) {
    console.error('[EPay Notify] 签名验证失败', { body });
    return null;
  }

  // 检查交易状态（TRADE_SUCCESS 表示成功）
  const tradeStatus = body.trade_status;
  if (tradeStatus !== 'TRADE_SUCCESS') {
    console.warn('[EPay Notify] 交易状态非成功', { tradeStatus });
    return null;
  }

  return {
    orderNo: body.out_trade_no,
    tradeNo: body.trade_no || '',
    money: body.money || '0',
    payType: body.type || '',
  };
}
