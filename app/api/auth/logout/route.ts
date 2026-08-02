/**
 * 退出登录接口
 * - 调用 supabase.auth.signOut 清除会话
 * - 等待 onAuthStateChange 回调完成，确保清除 cookie 的 Set-Cookie 头被写入响应
 */
import { NextResponse } from 'next/server';
import { getSupabaseServer, waitForAuthCookieFlush } from '@/lib/supabase-server';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';

export async function POST() {
  try {
    const supabase = await getSupabaseServer();
    await supabase.auth.signOut();
    // 等待 SIGNED_OUT 事件的 onAuthStateChange 回调完成，确保清除 cookie 的 Set-Cookie 头被写入响应
    await waitForAuthCookieFlush();
    return NextResponse.json(successResponse(null, '已退出登录'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Auth Logout] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
