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

/**
 * 验证码服务商抽象接口
 * 业务接口仅依赖此接口，不直接依赖极验实现
 */
export interface CaptchaProvider {
  /**
   * 校验前端提交的验证票据
   * @param ticket 前端极验组件返回的票据四元组
   * @returns true=校验通过，false=校验失败
   */
  verifyTicket(ticket: CaptchaTicket): Promise<boolean>;
}

// ============ 极验 GeeTest 4 实现 ============

/**
 * 极验四代验证码实现
 *
 * 接入流程：
 * 1. 前端通过 gt4.js 加载极验组件，传入 NEXT_PUBLIC_GEETEST_CAPTCHA_ID
 * 2. 用户通过验证后，前端拿到 lot_number + captcha_output + pass_token + gen_time
 * 3. 前端将票据四元组随业务请求提交到后端
 * 4. 后端调用本类的 verifyTicket 方法，向极验服务端发起二次校验
 * 5. 极验返回 result: "success" 即通过
 */
export class Geetest4Provider implements CaptchaProvider {
  private readonly captchaId: string;
  private readonly captchaKey: string;
  /** 极验四代服务端校验接口 */
  private readonly verifyUrl = 'https://gcaptcha4.geetest.com/verify';

  constructor(captchaId: string, captchaKey: string) {
    this.captchaId = captchaId;
    this.captchaKey = captchaKey;
  }

  /**
   * 向极验服务端发起票据二次校验
   * 文档：https://docs.geetest.com/gt4/apirefer/api/server
   */
  async verifyTicket(ticket: CaptchaTicket): Promise<boolean> {
    // 参数完整性校验
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
      return false;
    }

    console.log('[Geetest4] 开始校验', {
      captchaId: this.captchaId,
      lot_number: ticket.lot_number,
      gen_time: ticket.gen_time,
      // 只输出长度和前几位，避免泄露完整票据
      output_len: ticket.captcha_output.length,
      token_len: ticket.pass_token.length,
    });

    // 极验四代校验签名：Wgt5d (MD5(lot_number + captcha_output + pass_token + gen_time + captchaKey))
    const signStr =
      ticket.lot_number +
      ticket.captcha_output +
      ticket.pass_token +
      ticket.gen_time +
      this.captchaKey;

    // 使用 Node 内置 crypto 模块计算 MD5（避免引入额外依赖）
    const { createHash } = await import('crypto');
    const signToken = createHash('md5').update(signStr).digest('hex');

    // 构造请求参数
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
      // 设置 5 秒超时，防止极验服务异常拖垮接口
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
        return false;
      }

      const data = (await response.json()) as { result?: string; reason?: string };
      console.log('[Geetest4] 极验返回', data);

      // 极验返回 result: "success" 表示验证通过
      if (data.result === 'success') {
        return true;
      }

      console.warn('[Geetest4] 校验失败 reason=', data.reason);
      return false;
    } catch (error) {
      console.error('[Geetest4] 校验异常', error);
      return false;
    }
  }
}

// ============ Mock 实现（开发/测试环境，未配置极验密钥时使用）============

/**
 * 开发环境 Mock 验证码 Provider
 * 当未配置极验密钥时自动启用，所有票据默认通过
 * 生产环境必须配置真实密钥，否则视为不安全
 */
export class MockCaptchaProvider implements CaptchaProvider {
  async verifyTicket(_ticket: CaptchaTicket): Promise<boolean> {
    console.warn('[Captcha] 使用 Mock Provider，跳过验证码校验。请确认生产环境已配置极验密钥。');
    return true;
  }
}

// ============ 工厂函数（业务层入口）============

/**
 * 获取验证码 Provider 实例
 *
 * 自动判断：
 * - 已配置极验密钥 → 使用 Geetest4Provider
 * - 未配置 → 使用 MockCaptchaProvider（开发环境）
 *
 * 切换其他服务商时，仅修改此处即可
 */
export function getCaptchaProvider(): CaptchaProvider {
  // 后端优先使用纯服务端变量 GEETEST_CAPTCHA_ID（不暴露给前端，更安全）
  // 回退到 NEXT_PUBLIC_GEETEST_CAPTCHA_ID（前端共用变量，向后兼容）
  const captchaId =
    process.env.GEETEST_CAPTCHA_ID || process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID;
  const captchaKey = process.env.GEETEST_CAPTCHA_KEY;

  if (captchaId && captchaKey) {
    console.log('[Captcha] 使用 Geetest4Provider', {
      captchaId,
      keyLen: captchaKey.length,
      idSource: process.env.GEETEST_CAPTCHA_ID ? 'GEETEST_CAPTCHA_ID' : 'NEXT_PUBLIC_GEETEST_CAPTCHA_ID',
    });
    return new Geetest4Provider(captchaId, captchaKey);
  }

  console.warn('[Captcha] 使用 MockCaptchaProvider', {
    hasCaptchaId: !!captchaId,
    hasCaptchaKey: !!captchaKey,
    hint: '请检查 Vercel 环境变量 GEETEST_CAPTCHA_ID 和 GEETEST_CAPTCHA_KEY 是否已配置 Production 环境',
  });
  return new MockCaptchaProvider();
}

/**
 * 判断当前是否启用了真实验证码校验
 * 用于前端提示开发者配置密钥
 */
export function isCaptchaConfigured(): boolean {
  const captchaId =
    process.env.GEETEST_CAPTCHA_ID || process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID;
  return !!(captchaId && process.env.GEETEST_CAPTCHA_KEY);
}
