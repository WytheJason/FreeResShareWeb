'use client';

/**
 * 举报工单管理页（客户端组件）
 * - 客户端 fetch /api/admin/reports
 * - 状态筛选：全部 / 待处理 / 已处理 / 已归档
 * - 标记已处理（弹出 handle_note 输入框）+ 归档
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import type { Report, ReportStatus, PageResult } from '@/lib/types';
import { REPORT_STATUS_LABELS } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import Pagination from '@/components/Pagination';
import Empty from '@/components/Empty';

const PAGE_SIZE = 20;

export default function AdminReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 处理对话框状态
  const [handleOpen, setHandleOpen] = useState(false);
  const [handleReport, setHandleReport] = useState<Report | null>(null);
  const [handleNote, setHandleNote] = useState('');

  // 拉取举报列表
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      const res = await fetch(`/api/admin/reports?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const data = json.data as PageResult<Report>;
        setReports(data.list);
        setTotal(data.total);
        setTotalPages(data.total_pages);
      } else {
        toast.show('error', json.message ?? '加载失败');
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setLoading(false);
    }
  }, [page, status, toast]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // 切换筛选回到第一页
  const handleFilterChange = (next: ReportStatus | '') => { setPage(1); setStatus(next); };

  // 打开"标记已处理"对话框
  const openHandleDialog = (report: Report) => {
    setHandleReport(report);
    setHandleNote(report.handle_note ?? '');
    setHandleOpen(true);
  };

  // 调用 PATCH 接口处理举报
  const patchReport = async (id: string, payload: { status: 'handled' | 'archived'; handle_note?: string }, label: string) => {
    try {
      setActionLoading(id + label);
      const res = await fetch('/api/admin/report/handle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', `${label}成功`);
        setHandleOpen(false);
        fetchReports();
      } else {
        toast.show('error', json.message ?? `${label}失败`);
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setActionLoading(null);
    }
  };

  // 确认标记已处理
  const confirmHandle = () => {
    if (!handleReport) return;
    patchReport(handleReport.id, { status: 'handled', handle_note: handleNote || undefined }, '标记已处理');
  };

  // 直接归档
  const archiveReport = (report: Report) => {
    if (!confirm('确定归档该举报工单？')) return;
    patchReport(report.id, { status: 'archived' }, '归档');
  };

  // 状态标签样式
  const getStatusTagCls = (s: ReportStatus) =>
    s === 'pending' ? 'bg-warning/15 text-warning'
      : s === 'handled' ? 'bg-success/15 text-success'
      : 'bg-bg-hover text-text-muted';

  return (
    <div className="space-y-4 fade-in">
      {/* 页头 */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="text-warning" size={22} />
        <h1 className="section-title">举报工单管理</h1>
      </div>
      {/* 筛选栏 */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">状态</span>
          <select
            className="input-field !w-32"
            value={status}
            onChange={(e) => handleFilterChange(e.target.value as ReportStatus | '')}
          >
            <option value="">全部</option>
            <option value="pending">待处理</option>
            <option value="handled">已处理</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <span className="text-xs text-text-dim">共 {total} 条</span>
      </div>

      {/* 举报表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-text-muted">
                <th className="px-3 py-3 text-left font-medium">举报人</th>
                <th className="px-3 py-3 text-left font-medium">帖子标题</th>
                <th className="px-3 py-3 text-left font-medium">举报原因</th>
                <th className="px-3 py-3 text-left font-medium">状态</th>
                <th className="px-3 py-3 text-left font-medium">举报时间</th>
                <th className="px-3 py-3 text-left font-medium">处理时间</th>
                <th className="px-3 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-text-dim">
                    加载中...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <Empty text="暂无举报工单" />
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border-subtle transition-colors hover:bg-bg-hover"
                  >
                    <td className="px-3 py-2 text-text-primary">{r.reporter_nickname || '匿名'}</td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <Link href={`/post/${r.post_id}`} className="link line-clamp-1">
                        {r.post_title || '已删除'}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-text-secondary max-w-[260px]">
                      <span className="line-clamp-2">{r.reason}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`tag ${getStatusTagCls(r.status)}`}>
                        {REPORT_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-dim whitespace-nowrap">
                      {formatDateTime(r.created_at)}
                    </td>
                    <td className="px-3 py-2 text-text-dim whitespace-nowrap">
                      {r.handled_at ? formatDateTime(r.handled_at) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {/* 待处理：标记已处理 + 归档 + 跳转帖子 */}
                        {r.status === 'pending' && (
                          <>
                            <button
                              className="btn-primary !px-2 !py-1 !text-xs"
                              disabled={actionLoading === r.id + '标记已处理'}
                              onClick={() => openHandleDialog(r)}
                            >
                              标记已处理
                            </button>
                            <button
                              className="btn-secondary !px-2 !py-1 !text-xs"
                              disabled={actionLoading === r.id + '归档'}
                              onClick={() => archiveReport(r)}
                            >
                              归档
                            </button>
                          </>
                        )}
                        {/* 已处理：归档 */}
                        {r.status === 'handled' && (
                          <button
                            className="btn-secondary !px-2 !py-1 !text-xs"
                            disabled={actionLoading === r.id + '归档'}
                            onClick={() => archiveReport(r)}
                          >
                            归档
                          </button>
                        )}
                        {/* 已归档：无操作 */}
                        {r.status === 'archived' && (
                          <span className="text-xs text-text-dim">无</span>
                        )}
                        {/* 跳转帖子（待处理/已处理都有）*/}
                        {r.status !== 'archived' && (
                          <Link
                            href={`/post/${r.post_id}`}
                            className="btn-secondary !px-2 !py-1 !text-xs"
                            title="查看帖子"
                          >
                            <ExternalLink size={12} />
                            帖子
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {/* 处理对话框 */}
      {handleOpen && handleReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 fade-in"
          onClick={() => setHandleOpen(false)}
        >
          <div
            className="card w-full max-w-md space-y-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <AlertTriangle size={18} className="text-warning" />
                标记已处理
              </h3>
              <button onClick={() => setHandleOpen(false)} aria-label="关闭">
                <X size={16} className="text-text-dim hover:text-text-primary" />
              </button>
            </div>

            <div className="space-y-2 text-sm text-text-muted">
              <p>帖子：{handleReport.post_title || '已删除'}</p>
              <p>原因：{handleReport.reason}</p>
            </div>
            <div>
              <p className="mb-2 text-xs text-text-muted">处理说明（选填）</p>
              <textarea
                className="input-field resize-none"
                rows={3}
                value={handleNote}
                onChange={(e) => setHandleNote(e.target.value)}
                placeholder="记录处理结果或备注"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setHandleOpen(false)}>取消</button>
              <button
                className="btn-primary"
                onClick={confirmHandle}
                disabled={actionLoading === handleReport.id + '标记已处理'}
              >确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
