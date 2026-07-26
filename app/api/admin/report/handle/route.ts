/**
 * 处理举报工单接口
 * - 必须管理员
 * - 支持 status: 'handled' | 'archived'
 * - 写入 handle_note 与 handled_at=now()
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import type { ReportStatus } from '@/lib/types';

// 允许的目标状态
const TARGET_STATUS_SET: ReportStatus[] = ['handled', 'archived'];

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, handle_note } = body as {
      id: string;
      status: ReportStatus;
      handle_note?: string;
    };

    // ---------- 1. 管理员校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!isAdmin(user)) {
      return NextResponse.json(errorResponse('无权操作，仅管理员可访问', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // ---------- 2. 参数校验 ----------
    if (!id) {
      return NextResponse.json(errorResponse('缺少举报 id', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    if (!status || !TARGET_STATUS_SET.includes(status)) {
      return NextResponse.json(errorResponse('status 不合法', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // ---------- 3. 查询举报是否存在 ----------
    const { data: report, error: queryError } = await admin
      .from('report')
      .select('id, status')
      .eq('id', id)
      .single();

    if (queryError || !report) {
      return NextResponse.json(errorResponse('举报记录不存在', 404), {
        status: HTTP_STATUS.NOT_FOUND,
      });
    }

    // ---------- 4. 执行更新 ----------
    const updateData: Record<string, unknown> = {
      status,
      handled_at: new Date().toISOString(),
    };
    if (handle_note !== undefined) {
      updateData.handle_note = handle_note.trim() || null;
    }

    const { error: updateError } = await admin
      .from('report')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(errorResponse(updateError.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    return NextResponse.json(successResponse(null, '处理成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Admin Report Handle] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
