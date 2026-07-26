/**
 * 退出登录接口
 * - 调用 supabase.auth.signOut 清除会话
 */
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';

export async function POST() {
  try {
    const supabase = await getSupabaseServer();
    await supabase.auth.signOut();
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
