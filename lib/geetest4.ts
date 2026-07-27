/**
 * 极验 GeeTest 四代无感验证 - 独立封装工具
 *
 * 设计目标：
 * 1. 业务接口仅依赖 CaptchaProvider 抽象接口，不耦合极验具体实现
 * 2. 后续切换阿里云/腾讯云验证码，仅需新增 Provider 实现并修改工厂函数
 * 3. 前端组件通过 NEXT_PUBLIC_GEETEST_CAPTCHA_ID 加载，后端用 GEETEST_CAPTCHA_KEY 校验
 *
 * 极验四代官方文档：https://docs.geetest.com/gt4/
 */

import type { CaptchaTicket } from './types';

// ============ 抽象接口（业务层依赖此接口）============

export interface VerifyResult {
  pass: boolean;
  reason?: string;
}

/**
 * 验证码服务商抽象接口
 * 业务接口仅依赖此接口，不直接依赖极验实现
 */
export interface CaptchaProvider {
  /**
   * 校验前端提交的验证票据
   * @param ticket 前端极验组件返回的票据四元组
   * @returns pass=true 校验通过，pass=false 校验失败，reason 为失败原因
   */
  verifyTicket(ticket: CaptchaTicket): Promise<VerifyResult>;
}

// ============ 极验 GeeTest 4 实现 ============

export class Geetest4Provider implements CaptchaProvider {
  static readonly providerName = 'Geetest4Provider';
  readonly providerName = Geetest4Provider.providerName;

  private readonly captchaId: string;
  private readonly captchaKey: string;
  private readonly verifyUrl = 'https://gcaptcha4.geetest.com/verify';

  constructor(captchaId: string, captchaKey: string) {
    this.captchaId = captchaId;
    this.captchaKey = captchaKey;
  }

  async verifyTicket(ticket: CaptchaTicket): Promise<VerifyResult> {
    if (
      !ticket.lot_number ||
      !ticket.captcha_output ||
      !ticket.pass_token ||
      !ticket.gen_time
    ) {
      console.warn('[Geetest4] 票据参数不完整', {
        has_lot: !!ticket.lot_number,
        has_output: !!ticket.captcha_output,
        has_token: !!ticket.pass_token,
        has_gen_time: !!ticket.gen_time,
      });
      return { pass: false, reason: '票据参数不完整' };
    }

    console.log('[Geetest4] 开始校验', {
      captchaId: this.captchaId,
      lot_number: ticket.lot_number,
      gen_time: ticket.gen_time,
      output_len: ticket.captcha_output.length,
      token_len: ticket.pass_token.length,
    });

    // 签名算法：MD5(lot_number + captcha_output + pass_token + gen_time + captchaKey)
    const signStr =
      ticket.lot_number +
      ticket.captcha_output +
      ticket.pass_token +
      ticket.gen_time +
      this.captchaKey;

    const { createHash } = await import('crypto');
    const signToken = createHash('md5').update(signStr).digest('hex');

    const params = new URLSearchParams({
      lot_number: ticket.lot_number,
      captcha_output: ticket.captcha_output,
      pass_token: ticket.pass_token,
      gen_time: ticket.gen_time,
      sign_token: signToken,
      captcha_id: this.captchaId,
    });

    const requestUrl = `${this.verifyUrl}?${params.toString()}`;
    console.log('[Geetest4] 请求极验服务端', this.verifyUrl);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(requestUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      console.log('[Geetest4] 极验响应', {
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        console.error('[Geetest4] HTTP 错误', response.status, response.statusText);
        return { pass: false, reason: `极验服务端 HTTP ${response.status}` };
      }

      const data = (await response.json()) as { result?: string; reason?: string };
      console.log('[Geetest4] 极验返回', data);

      if (data.result === 'success') {
        return { pass: true };
      }

      console.warn('[Geetest4] 校验失败 reason=', data.reason);
      return { pass: false, reason: data.reason || '极验校验未通过' };
    } catch (error) {
      console.error('[Geetest4] 校验异常', error);
      return { pass: false, reason: '极验服务端连接异常' };
    }
  }
}

// ============ Mock 实现（开发/测试环境）============

export class MockCaptchaProvider implements CaptchaProvider {
  static readonly providerName = 'MockCaptchaProvider';
  readonly providerName = MockCaptchaProvider.providerName;

  async verifyTicket(_ticket: CaptchaTicket): Promise<VerifyResult> {
    console.warn('[Captcha] 使用 Mock Provider，跳过验证码校验。');
    return { pass: true };
  }
}

// ============ 工厂函数（业务层入口）============

export function getCaptchaProvider(): CaptchaProvider {
  const captchaId =
    process.env.GEETEST_CAPTCHA_ID || process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID;
  const captchaKey = process.env.GEETEST_CAPTCHA_KEY;

  if (captchaId && captchaKey) {
    const provider = new Geetest4Provider(captchaId, captchaKey);
    console.log('[Captcha] 使用 Geetest4Provider', {
      captchaId,
      keyLen: captchaKey.length,
      keyPreview: `${captchaKey.slice(0, 4)}...${captchaKey.slice(-4)}`,
      idSource: process.env.GEETEST_CAPTCHA_ID ? 'GEETEST_CAPTCHA_ID' : 'NEXT_PUBLIC_GEETEST_CAPTCHA_ID',
    });
    return provider;
  }

  console.warn('[Captcha] 使用 MockCaptchaProvider', {
    hasCaptchaId: !!captchaId,
    hasCaptchaKey: !!captchaKey,
    hint: '请检查 Vercel 环境变量 GEETEST_CAPTCHA_ID 和 GEETEST_CAPTCHA_KEY 是否已配置 Production 环境',
  });
  return new MockCaptchaProvider();
}

export function isCaptchaConfigured(): boolean {
  const captchaId =
    process.env.GEETEST_CAPTCHA_ID || process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID;
  return !!(captchaId && process.env.GEETEST_CAPTCHA_KEY);
}
