/**
 * 临时诊断接口 - 排查极验配置问题
 * 部署稳定后建议删除此文件
 */
import { NextResponse } from 'next/server';
import { getCaptchaProvider, isCaptchaConfigured } from '@/lib/geetest4';

export async function GET() {
  const captchaId =
    process.env.GEETEST_CAPTCHA_ID || process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID;
  const captchaKey = process.env.GEETEST_CAPTCHA_KEY;
  const nextPublicId = process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID;
  const backendOnlyId = process.env.GEETEST_CAPTCHA_ID;

  // 调用一次 getCaptchaProvider 触发日志输出（便于在 Vercel Logs 中看到）
  const provider = getCaptchaProvider();
  const providerName = provider.constructor.name;

  // 模拟一次假票据校验，触发对极验服务端的实际请求（便于在 Vercel Logs 中看到 HTTP 响应）
  let fakeVerifyResult: string | null = null;
  try {
    const fakeTicket = {
      lot_number: 'fake_lot_number_for_diagnostic',
      captcha_output: 'fake_output',
      pass_token: 'fake_token',
      gen_time: '20260101',
    };
    const result = await provider.verifyTicket(fakeTicket as never);
    fakeVerifyResult = result ? 'true' : 'false';
  } catch (e) {
    fakeVerifyResult = 'exception: ' + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel_region: process.env.VERCEL_REGION || 'local',
    captcha: {
      isConfigured: isCaptchaConfigured(),
      providerUsed: providerName,
      // 脱敏输出：只显示前后若干字符
      nextPublicId: nextPublicId
        ? `${nextPublicId.slice(0, 6)}...${nextPublicId.slice(-4)} (len=${nextPublicId.length})`
        : 'NOT_SET',
      backendOnlyId: backendOnlyId
        ? `${backendOnlyId.slice(0, 6)}...${backendOnlyId.slice(-4)} (len=${backendOnlyId.length})`
        : 'NOT_SET',
      captchaIdResolved: captchaId
        ? `${captchaId.slice(0, 6)}...${captchaId.slice(-4)} (len=${captchaId.length})`
        : 'NOT_SET',
      captchaKey: captchaKey
        ? `${captchaKey.slice(0, 4)}...${captchaKey.slice(-4)} (len=${captchaKey.length})`
        : 'NOT_SET',
    },
    fakeVerifyResult,
    hint:
      providerName === 'MockCaptchaProvider'
        ? '❌ 后端使用了 Mock Provider，说明 GEETEST_CAPTCHA_KEY 未配置或为空。请在 Vercel Environment Variables 中添加。'
        : providerName === 'Geetest4Provider'
        ? fakeVerifyResult === 'false'
          ? '✅ Geetest4Provider 已启用，假票据校验返回 false（预期行为，说明已正确向极验发起请求）。请查看 Vercel Logs 中的 [Geetest4] 日志确认极验返回内容。'
          : `✅ Geetest4Provider 已启用，假票据校验返回 ${fakeVerifyResult}`
        : '⚠️ 未知 Provider',
  }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
