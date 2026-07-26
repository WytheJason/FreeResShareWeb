/**
 * 登录接口
 * - 调用 Supabase Auth signInWithPassword
 * - 返回用户基本信息
 */
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { successResponse, errorResponse, HTTP_STATUS, isValidEmail } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    // ---------- 参数校验 ----------
    if (!isValidEmail(email)) {
      return NextResponse.json(errorResponse('邮箱格式不正确', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    if (!password) {
      return NextResponse.json(errorResponse('密码不能为空', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // ---------- 调用 Supabase 登录 ----------
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(errorResponse('邮箱或密码错误', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    // 查询用户 profile（含封禁状态等）
    const { data: profile } = await supabase
      .from('user_profile')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profile?.is_banned) {
      // 封禁用户不允许登录使用接口（已签发会话由后续接口拦截）
      return NextResponse.json(errorResponse('账号已被封禁', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    return NextResponse.json(
      successResponse(
        {
          id: data.user.id,
          email: data.user.email,
          nickname: profile?.nickname ?? '',
          avatar: profile?.avatar ?? '',
          is_admin: profile?.is_admin ?? false,
          is_vip: profile?.is_vip ?? false,
        },
        '登录成功'
      ),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[Auth Login] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
