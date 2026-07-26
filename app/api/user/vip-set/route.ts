/**
 * 管理员 VIP 操作接口
 * - action=open:   设置 is_vip=true, vip_started_at=now, vip_expired_at=now+days天
 * - action=renew:  在原 vip_expired_at 基础上 +days天（若已过期则从 now 开始）
 * - action=cancel: is_vip=false
 * - 写入 vip_log 表（operator_id=当前管理员）
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import type { VipAction } from '@/lib/types';

// 允许的 action
const ACTION_SET: VipAction[] = ['open', 'renew', 'cancel'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, action, days, note } = body as {
      user_id: string;
      action: VipAction;
      days: number;
      note?: string;
    };

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
    if (!action || !ACTION_SET.includes(action)) {
      return NextResponse.json(errorResponse('action 不合法', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }
    if (action !== 'cancel') {
      if (typeof days !== 'number' || days <= 0 || days > 3650) {
        return NextResponse.json(errorResponse('days 需为 1-3650 之间的正整数', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
    }

    // 不能对自己执行取消
    if (action === 'cancel' && user_id === operator.id) {
      return NextResponse.json(errorResponse('不能取消自己的 VIP', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // ---------- 3. 查询目标用户 ----------
    const { data: target, error: queryError } = await admin
      .from('user_profile')
      .select('id, is_vip, vip_started_at, vip_expired_at')
      .eq('id', user_id)
      .single();

    if (queryError || !target) {
      return NextResponse.json(errorResponse('目标用户不存在', 404), {
        status: HTTP_STATUS.NOT_FOUND,
      });
    }

    // ---------- 4. 执行 VIP 操作 ----------
    const now = new Date();
    let updateData: Record<string, unknown> = {};
    let logDays = 0;

    if (action === 'open') {
      const expiredAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      updateData = {
        is_vip: true,
        vip_started_at: now.toISOString(),
        vip_expired_at: expiredAt.toISOString(),
      };
      logDays = days;
    } else if (action === 'renew') {
      // 已过期或未开通则从 now 开始
      const baseExpired = target.vip_expired_at
        ? new Date(target.vip_expired_at)
        : null;
      const startBase = baseExpired && baseExpired.getTime() > now.getTime() ? baseExpired : now;
      const expiredAt = new Date(startBase.getTime() + days * 24 * 60 * 60 * 1000);
      updateData = {
        is_vip: true,
        vip_expired_at: expiredAt.toISOString(),
        // 若之前未设置 vip_started_at，则补齐
        vip_started_at: target.vip_started_at ?? now.toISOString(),
      };
      logDays = days;
    } else {
      // cancel
      updateData = {
        is_vip: false,
      };
      logDays = 0;
    }

    const { error: updateError } = await admin
      .from('user_profile')
      .update(updateData)
      .eq('id', user_id);

    if (updateError) {
      return NextResponse.json(errorResponse(updateError.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // ---------- 5. 写入 vip_log ----------
    await admin.from('vip_log').insert({
      user_id,
      operator_id: operator.id,
      action,
      days: logDays,
      note: note ?? null,
    });

    return NextResponse.json(successResponse(null, '操作成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[User VipSet] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
