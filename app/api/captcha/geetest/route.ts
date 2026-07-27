/**
 * 极验后端票据校验（统一校验入口）
 * - 接收前端提交的 CaptchaTicket
 * - 调用 CaptchaProvider.verifyTicket 二次校验
 */
import { NextResponse } from 'next/server';
import { getCaptchaProvider } from '@/lib/geetest4';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import type { CaptchaTicket } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const ticket = (await request.json()) as CaptchaTicket;

    if (
      !ticket ||
      !ticket.lot_number ||
      !ticket.captcha_output ||
      !ticket.pass_token ||
      !ticket.gen_time
    ) {
      return NextResponse.json(errorResponse('票据参数不完整', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const provider = getCaptchaProvider();
    const result = await provider.verifyTicket(ticket);

    return NextResponse.json(
      successResponse({ verified: result.pass, reason: result.reason }, result.pass ? '校验通过' : `校验失败：${result.reason || '未知原因'}`),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[Captcha Geetest] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
