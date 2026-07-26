/**
 * 后台举报列表接口
 * - 必须管理员
 * - 关联 post_title 与 reporter_nickname
 * - 支持 status 过滤
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  calcPageRange,
  calcTotalPages,
} from '@/lib/utils';
import type { Report, PageResult, ReportStatus } from '@/lib/types';

const STATUS_SET: ReportStatus[] = ['pending', 'handled', 'archived'];

export async function GET(request: Request) {
  try {
    // ---------- 1. 管理员校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!isAdmin(user)) {
      return NextResponse.json(errorResponse('无权访问，仅管理员可访问', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('page_size') ?? '10') || 10));
    const status = searchParams.get('status') ?? undefined;

    // ---------- 2. 构建查询 ----------
    const admin = getSupabaseServiceAdmin();
    let query = admin
      .from('report')
      .select(
        'id, post_id, reporter_id, reason, status, handle_note, created_at, handled_at, post:posts!report_post_id_fkey(title), reporter:user_profile!report_reporter_id_fkey(nickname)',
        { count: 'exact' }
      );

    if (status && STATUS_SET.includes(status as ReportStatus)) {
      query = query.eq('status', status);
    }

    const { from, to } = calcPageRange(page, pageSize);
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(errorResponse(error.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const total = count ?? 0;

    // ---------- 3. 整理返回结构 ----------
    const list: Report[] = (data ?? []).map((item: any) => {
      const post = item.post?.[0] ?? item.post ?? {};
      const reporter = item.reporter?.[0] ?? item.reporter ?? {};
      return {
        id: item.id,
        post_id: item.post_id,
        post_title: post.title ?? '',
        reporter_id: item.reporter_id,
        reporter_nickname: reporter.nickname ?? '',
        reason: item.reason,
        status: item.status,
        handle_note: item.handle_note ?? null,
        created_at: item.created_at,
        handled_at: item.handled_at ?? null,
      } as Report;
    });

    const result: PageResult<Report> = {
      list,
      total,
      page,
      page_size: pageSize,
      total_pages: calcTotalPages(total, pageSize),
    };

    return NextResponse.json(successResponse(result, '查询成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Admin Reports] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
