/**
 * 修改密码接口
 * - 验证当前用户登录态
 * - 验证原密码正确性（通过重新登录 Supabase Auth）
 * - 调用 Supabase Auth 更新密码
 * - 不触发邮箱重新验证（用户已登录）
 */
import { NextResponse } from 'next/server';
import { getSupabaseServer, waitForAuthCookieFlush } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  isValidPassword,
} from '@/lib/utils';

export async function PUT(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(errorResponse('请先登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    const body = await request.json();
    const { oldPassword, newPassword } = body as {
      oldPassword: string;
      newPassword: string;
    };

    // ---------- 参数校验 ----------
    if (!oldPassword) {
      return NextResponse.json(errorResponse('请输入原密码', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    if (!newPassword) {
      return NextResponse.json(errorResponse('请输入新密码', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    if (!isValidPassword(newPassword)) {
      return NextResponse.json(
        errorResponse('新密码格式错误：8-32位，必须包含字母和数字', 1),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    if (oldPassword === newPassword) {
      return NextResponse.json(errorResponse('新密码不能与原密码相同', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const supabase = await getSupabaseServer();

    // ---------- 验证原密码：通过重新登录校验 ----------
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: oldPassword,
    });
    if (signInError) {
      return NextResponse.json(errorResponse('原密码错误', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // ---------- 更新密码 ----------
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      console.error('[Auth Password] 更新密码失败', updateError);
      return NextResponse.json(errorResponse('修改失败，请稍后重试', 500), {
        status: HTTP_STATUS.INTERNAL_ERROR,
      });
    }

    // 等待 onAuthStateChange 回调完成（USER_UPDATED 事件会触发 cookie 刷新）
    await waitForAuthCookieFlush();

    return NextResponse.json(successResponse(null, '密码修改成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Auth Password] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
