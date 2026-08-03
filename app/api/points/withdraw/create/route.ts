/**
 * 积分兑现接口
 * POST /api/points/withdraw/create
 * body: { points_cost, payment_method, payment_account, payment_name }
 *
 * 流程：
 * 1. 验证登录态
 * 2. 校验兑换档位是否合法（2000/5000/10000）
 * 3. 检查积分余额是否充足
 * 4. 检查是否有 pending 状态的兑换（防重复提交）
 * 5. 调用 RPC change_user_points 原子扣减积分
 * 6. 写入 points_withdraw 记录
 * 7. 返回兑换记录
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';
import { WITHDRAW_TIERS } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('请先登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }

    const body = await request.json();
    const { points_cost, payment_method, payment_account, payment_name } = body as {
      points_cost: number;
      payment_method: string;
      payment_account: string;
      payment_name: string;
    };

    // ---------- 1. 校验兑换档位 ----------
    const tier = WITHDRAW_TIERS.find((t) => t.points === points_cost);
    if (!tier) {
      return NextResponse.json(
        errorResponse('兑换档位无效，请选择 2000 / 5000 / 10000 积分档位', 1),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // ---------- 2. 校验收款信息 ----------
    if (!payment_method || !['alipay', 'wxpay'].includes(payment_method)) {
      return NextResponse.json(errorResponse('请选择收款方式（支付宝或微信）', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const account = payment_account?.trim();
    if (!account || account.length < 2) {
      return NextResponse.json(errorResponse('请填写有效的收款账号', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const name = payment_name?.trim();
    if (!name || name.length < 2) {
      return NextResponse.json(errorResponse('请填写收款人真实姓名', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // ---------- 3. 检查是否有待处理的兑换 ----------
    const { data: pendingRecord } = await admin
      .from('points_withdraw')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingRecord) {
      return NextResponse.json(
        errorResponse('您有一笔兑换申请正在处理中，请等待处理完成后再提交', 1),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // ---------- 4. 检查积分余额 ----------
    if ((user.points ?? 0) < tier.points) {
      return NextResponse.json(
        errorResponse(`积分不足，需要 ${tier.points} 积分，当前 ${user.points ?? 0} 积分`, 1),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // ---------- 5. 原子扣减积分 ----------
    const { data: success, error: rpcError } = await admin.rpc('change_user_points', {
      p_user_id: user.id,
      p_amount: -tier.points,
      p_action: 'withdraw',
      p_note: `积分兑现 ${tier.points} 积分 → ${tier.amount} 元`,
    });

    if (rpcError || !success) {
      return NextResponse.json(
        errorResponse('积分扣减失败，可能余额不足或网络异常', 1),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // ---------- 6. 写入兑换记录 ----------
    const { data: record, error: insertError } = await admin
      .from('points_withdraw')
      .insert({
        user_id: user.id,
        points_cost: tier.points,
        amount: tier.amount,
        payment_method: payment_method as 'alipay' | 'wxpay',
        payment_account: account,
        payment_name: name,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !record) {
      // 兑换记录写入失败，回滚积分
      console.error('[Withdraw] 写入兑换记录失败:', insertError?.message);
      try {
        await admin.rpc('change_user_points', {
          p_user_id: user.id,
          p_amount: tier.points,
          p_action: 'withdraw_refund',
          p_note: '兑换记录写入失败，退还积分',
        });
      } catch (rollbackErr) {
        console.error('[Withdraw] 积分回滚失败:', rollbackErr);
      }
      return NextResponse.json(errorResponse('兑换失败，积分已退还', 1), {
        status: HTTP_STATUS.INTERNAL_ERROR,
      });
    }

    return NextResponse.json(
      successResponse(record, `兑换申请已提交，扣除 ${tier.points} 积分，等待处理`),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[Withdraw Create] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
