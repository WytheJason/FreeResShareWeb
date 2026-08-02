'use client';

/**
 * 评论管理页（客户端组件）
 * - 客户端 fetch /api/admin/comments
 * - 单条删除 + 跳转帖子详情
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Trash2, ExternalLink } from 'lucide-react';
import type { PageResult } from '@/lib/types';
import { formatDateTime, truncateText } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import Pagination from '@/components/Pagination';
import Empty from '@/components/Empty';

// 后台评论数据结构
interface AdminComment {
  id: string;
  post_id: string;
  post_title: string;
  content: string;
  user_id: string;
  user_nickname: string;
  user_avatar: string;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function AdminCommentsPage() {
  const toast = useToast();
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 拉取评论列表
  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/comments?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const data = json.data as PageResult<AdminComment>;
        setComments(data.list);
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
  }, [page, toast]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // 删除评论
  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该评论？')) return;
    try {
      setDeletingId(id);
      const res = await fetch('/api/comment/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', '删除成功');
        fetchComments();
      } else {
        toast.show('error', json.message ?? '删除失败');
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 fade-in">
      {/* 页头 */}
      <div className="flex items-center gap-2">
        <MessageCircle className="text-success" size={22} />
        <h1 className="section-title">评论管理</h1>
        <span className="text-xs text-text-dim">共 {total} 条</span>
      </div>

      {/* 评论表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-text-muted">
                <th className="px-3 py-3 text-left font-medium">评论人</th>
                <th className="px-3 py-3 text-left font-medium">头像</th>
                <th className="px-3 py-3 text-left font-medium">内容</th>
                <th className="px-3 py-3 text-left font-medium">所属帖子</th>
                <th className="px-3 py-3 text-left font-medium">时间</th>
                <th className="px-3 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-text-dim">
                    加载中...
                  </td>
                </tr>
              ) : comments.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <Empty text="暂无评论" />
                  </td>
                </tr>
              ) : (
                comments.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border-subtle transition-colors hover:bg-bg-hover"
                  >
                    <td className="px-3 py-2 text-text-primary">{c.user_nickname || '匿名'}</td>
                    <td className="px-3 py-2">
                      {c.user_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.user_avatar}
                          alt={c.user_nickname}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-500/20 text-xs text-primary-300">
                          {(c.user_nickname || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-text-secondary max-w-[280px]">
                      <span className="line-clamp-2">{truncateText(c.content, 200)}</span>
                    </td>
                    <td className="px-3 py-2 max-w-[180px]">
                      <Link href={`/post/${c.post_id}`} className="link line-clamp-1">
                        {c.post_title || '已删除'}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-text-dim whitespace-nowrap">
                      {formatDateTime(c.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          className="btn-danger !px-2 !py-1 !text-xs"
                          disabled={deletingId === c.id}
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 size={12} />
                          删除
                        </button>
                        <Link
                          href={`/post/${c.post_id}`}
                          className="btn-secondary !px-2 !py-1 !text-xs"
                          title="查看帖子"
                        >
                          <ExternalLink size={12} />
                          帖子
                        </Link>
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
    </div>
  );
}
