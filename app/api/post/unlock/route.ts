/**
 * 积分解锁资源接口
 * POST /api/post/unlock
 * body: { post_id: string }
 *
 * 流程：
 * 1. 验证登录态
 * 2. 查询帖子 points_cost
 * 3. 检查是否已解锁（防重复扣费）
 * 4. 调用 RPC change_user_points 原子扣减积分
 * 5. 写入 post_unlock 记录
 * 6. 返回完整资源链接
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/utils';

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
    const { post_id } = body as { post_id: string };

    if (!post_id || typeof post_id !== 'string') {
      return NextResponse.json(errorResponse('缺少 post_id 参数', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const admin = getSupabaseServiceAdmin();

    // ---------- 1. 查询帖子信息 ----------
    const { data: post } = await admin
      .from('posts')
      .select('id, title, pan_url, pan_code, points_cost, author_id, status')
      .eq('id', post_id)
      .single();

    if (!post || post.status !== 'normal') {
      return NextResponse.json(errorResponse('资源不存在或已下架', 404), {
        status: HTTP_STATUS.NOT_FOUND,
      });
    }

    // 作者无需解锁
    if (post.author_id === user.id) {
      return NextResponse.json(
        successResponse({ pan_url: post.pan_url, pan_code: post.pan_code }, '作者无需解锁'),
        { status: HTTP_STATUS.OK }
      );
    }

    // 免费资源无需解锁
    if (post.points_cost <= 0) {
      return NextResponse.json(
        successResponse({ pan_url: post.pan_url, pan_code: post.pan_code }, '免费资源无需解锁'),
        { status: HTTP_STATUS.OK }
      );
    }

    // ---------- 2. 检查是否已解锁 ----------
    const { data: unlockRecord } = await admin
      .from('post_unlock')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', post_id)
      .maybeSingle();

    if (unlockRecord) {
      // 已解锁，直接返回链接
      return NextResponse.json(
        successResponse({ pan_url: post.pan_url, pan_code: post.pan_code }, '已解锁，无需重复扣费'),
        { status: HTTP_STATUS.OK }
      );
    }

    // ---------- 3. 检查积分余额 ----------
    if (user.points < post.points_cost) {
      return NextResponse.json(
        errorResponse(`积分不足，需要 ${post.points_cost} 积分，当前 ${user.points} 积分`, 1),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // ---------- 4. 原子扣减积分 ----------
    const { data: success, error: rpcError } = await admin.rpc('change_user_points', {
      p_user_id: user.id,
      p_amount: -post.points_cost,
      p_action: 'unlock_post',
      p_post_id: post_id,
      p_note: `解锁资源: ${post.title.slice(0, 30)}`,
    });

    if (rpcError || !success) {
      return NextResponse.json(
        errorResponse('积分扣减失败，可能余额不足或网络异常', 1),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // ---------- 5. 写入解锁记录 ----------
    const { error: unlockError } = await admin.from('post_unlock').insert({
      user_id: user.id,
      post_id: post_id,
      cost_points: post.points_cost,
    });

    if (unlockError) {
      // 解锁记录写入失败，但积分已扣，记录错误日志
      console.error('[Unlock] 写入解锁记录失败:', unlockError.message);
      // 尝试回滚积分（失败时仅记录日志，不影响主流程）
      try {
        await admin.rpc('change_user_points', {
          p_user_id: user.id,
          p_amount: post.points_cost,
          p_action: 'admin_adjust',
          p_post_id: post_id,
          p_note: '解锁记录写入失败，退还积分',
        });
      } catch (rollbackErr) {
        console.error('[Unlock] 积分回滚失败:', rollbackErr);
      }
      return NextResponse.json(errorResponse('解锁失败，积分已退还', 1), {
        status: HTTP_STATUS.INTERNAL_ERROR,
      });
    }

    return NextResponse.json(
      successResponse(
        { pan_url: post.pan_url, pan_code: post.pan_code, cost_points: post.points_cost },
        `解锁成功，消耗 ${post.points_cost} 积分`
      ),
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('[Unlock] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
