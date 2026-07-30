/**
 * Cloudflare Turnstile 验证工具
 * 
 * 文档：https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

export interface TurnstileVerifyResult {
  success: boolean;
  error?: string;
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * 校验 Turnstile token
 * @param token 前端传递的 token
 * @param secretKey Turnstile Secret Key（从环境变量读取）
 * @param ip 可选，用户 IP 地址
 */
export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  ip?: string
): Promise<TurnstileVerifyResult> {
  if (!token || !secretKey) {
    return { success: false, error: '缺少 token 或 secretKey' };
  }

  const formData = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  if (ip) {
    formData.append('remoteip', ip);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();
    console.log('[Turnstile] 服务端返回', data);

    if (data.success === true) {
      return { success: true };
    }

    const errorCodes = data['error-codes'] || [];
    const errorMsg = errorCodes.length > 0 ? errorCodes.join(', ') : '验证失败';
    console.warn('[Turnstile] 验证失败', { errorCodes });
    return { success: false, error: errorMsg };
  } catch (err) {
    console.error('[Turnstile] 校验异常', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Turnstile 校验异常' 
    };
  }
}

/**
 * 获取 Turnstile Secret Key
 */
export function getTurnstileSecretKey(): string | undefined {
  return process.env.TURNSTILE_SECRET_KEY;
}