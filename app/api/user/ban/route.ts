/**
 * 管理员封禁/解封用户接口
 * - 必须管理员
 * - 不能封禁自己或其他管理员
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, banned } = body as { user_id: string; banned: boolean };

    // ---------- 1. 管理员校验 ----------
    const operator = await getCurrentUser();
    if (!operator) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!isAdmin(operator)) {
      return NextResponse.json(errorResponse('无权操作，仅管理员可访问', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // ---------- 2. 参数校验 ----------
    if (!user_id) {
      return NextResponse.json(errorResponse('缺少 user_id', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    if (typeof banned !== 'boolean') {
      return NextResponse.json(errorResponse('banned 需为 boolean', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // ---------- 3. 不能封禁自己 ----------
    if (user_id === operator.id) {
      return NextResponse.json(errorResponse('不能封禁/解封自己', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // ---------- 4. 查询目标用户，不能封禁其他管理员 ----------
    const { data: target, error: queryError } = await admin
      .from('user_profile')
      .select('id, is_admin')
      .eq('id', user_id)
      .single();

    if (queryError || !target) {
      return NextResponse.json(errorResponse('目标用户不存在', 404), {
        status: HTTP_STATUS.NOT_FOUND,
      });
    }
    if (target.is_admin) {
      return NextResponse.json(errorResponse('不能封禁其他管理员', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // ---------- 5. 执行封禁/解封 ----------
    const { error: updateError } = await admin
      .from('user_profile')
      .update({ is_banned: banned })
      .eq('id', user_id);

    if (updateError) {
      return NextResponse.json(errorResponse(updateError.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    return NextResponse.json(
      successResponse(null, banned ? '已封禁' : '已解封'),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[User Ban] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
