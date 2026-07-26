'use client';

/**
 * 帖子管理页（客户端组件）
 * - 客户端 fetch /api/admin/posts
 * - 状态/分类筛选
 * - 隐藏/恢复/通过/拒绝/置顶/取消置顶/删除
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Eye, MessageCircle, Pin, Crown } from 'lucide-react';
import type { Post, PostStatus, PostCategory, PageResult } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import Pagination from '@/components/Pagination';
import Empty from '@/components/Empty';

const PAGE_SIZE = 20;

// 帖子状态标签
const STATUS_LABELS: Record<PostStatus, string> = {
  normal: '正常',
  pending: '待审核',
  hidden: '隐藏',
};

export default function AdminPostsPage() {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<PostStatus | ''>('');
  const [category, setCategory] = useState<PostCategory | ''>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 拉取帖子列表
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (category) params.set('category', category);
      const res = await fetch(`/api/admin/posts?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const data = json.data as PageResult<Post>;
        setPosts(data.list);
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
  }, [page, status, category, toast]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // 修改筛选条件时回到第一页
  const handleFilterChange = (next: { status?: PostStatus | ''; category?: PostCategory | '' }) => {
    setPage(1);
    if (next.status !== undefined) setStatus(next.status);
    if (next.category !== undefined) setCategory(next.category);
  };

  // 更新帖子状态
  const updatePost = async (id: string, payload: Record<string, unknown>, label: string) => {
    try {
      setActionLoading(id + label);
      const res = await fetch('/api/post/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', `${label}成功`);
        fetchPosts();
      } else {
        toast.show('error', json.message ?? `${label}失败`);
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setActionLoading(null);
    }
  };

  // 删除帖子
  const deletePost = async (id: string) => {
    if (!confirm('确定删除该帖子？相关评论/收藏/举报将一并删除。')) return;
    try {
      setActionLoading(id + 'delete');
      const res = await fetch('/api/post/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', '删除成功');
        fetchPosts();
      } else {
        toast.show('error', json.message ?? '删除失败');
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4 fade-in">
      {/* 页头 */}
      <div className="flex items-center gap-2">
        <FileText className="text-primary-400" size={22} />
        <h1 className="section-title">帖子管理</h1>
      </div>

      {/* 筛选栏 */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">状态</span>
          <select
            className="input-field !w-32"
            value={status}
            onChange={(e) => handleFilterChange({ status: e.target.value as PostStatus | '' })}
          >
            <option value="">全部</option>
            <option value="normal">正常</option>
            <option value="pending">待审核</option>
            <option value="hidden">隐藏</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">分类</span>
          <select
            className="input-field !w-32"
            value={category}
            onChange={(e) => handleFilterChange({ category: e.target.value as PostCategory | '' })}
          >
            <option value="">全部</option>
            <option value="software">软件工具</option>
            <option value="movie">影视剧集</option>
          </select>
        </div>
        <span className="text-xs text-text-dim">共 {total} 条</span>
      </div>

      {/* 帖子表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-text-muted">
                <th className="px-3 py-3 text-left font-medium">封面</th>
                <th className="px-3 py-3 text-left font-medium">标题</th>
                <th className="px-3 py-3 text-left font-medium">分类</th>
                <th className="px-3 py-3 text-left font-medium">状态</th>
                <th className="px-3 py-3 text-left font-medium">VIP</th>
                <th className="px-3 py-3 text-left font-medium">置顶</th>
                <th className="px-3 py-3 text-left font-medium">浏览</th>
                <th className="px-3 py-3 text-left font-medium">评论</th>
                <th className="px-3 py-3 text-left font-medium">作者</th>
                <th className="px-3 py-3 text-left font-medium">发布时间</th>
                <th className="px-3 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-text-dim">
                    加载中...
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <Empty text="暂无帖子" />
                  </td>
                </tr>
              ) : (
                posts.map((p) => {
                  const statusTagCls =
                    p.status === 'normal'
                      ? 'bg-success/15 text-success'
                      : p.status === 'pending'
                      ? 'bg-warning/15 text-warning'
                      : 'bg-danger/15 text-danger';
                  const catTagCls = p.category === 'software' ? 'tag tag-software' : 'tag tag-movie';
                  return (
                    <tr key={p.id} className="border-b border-border-subtle transition-colors hover:bg-bg-hover">
                      <td className="px-3 py-2">
                        <div className="h-10 w-16 overflow-hidden rounded bg-bg-elevated">
                          {p.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.cover_url} alt={p.title} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/post/${p.id}`} className="link line-clamp-1 max-w-[200px]">{p.title}</Link>
                      </td>
                      <td className="px-3 py-2"><span className={catTagCls}>{CATEGORY_LABELS[p.category]}</span></td>
                      <td className="px-3 py-2"><span className={`tag ${statusTagCls}`}>{STATUS_LABELS[p.status]}</span></td>
                      <td className="px-3 py-2">
                        {p.is_vip ? <Crown size={14} className="text-gold-400" /> : <span className="text-text-dim">-</span>}
                      </td>
                      <td className="px-3 py-2">
                        {p.is_top ? <Pin size={14} className="text-danger" /> : <span className="text-text-dim">-</span>}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        <span className="flex items-center gap-1"><Eye size={12} />{p.view_count}</span>
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        <span className="flex items-center gap-1"><MessageCircle size={12} />{p.comment_count}</span>
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{p.author_nickname || '匿名'}</td>
                      <td className="px-3 py-2 text-text-dim">{formatDateTime(p.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {/* 正常帖：隐藏 + 置顶/取消置顶 */}
                          {p.status === 'normal' && (
                            <>
                              <button className="btn-danger !px-2 !py-1 !text-xs" disabled={actionLoading === p.id + '隐藏'} onClick={() => updatePost(p.id, { status: 'hidden' }, '隐藏')}>隐藏</button>
                              <button className="btn-secondary !px-2 !py-1 !text-xs" disabled={actionLoading === p.id + (p.is_top ? '取消置顶' : '置顶')} onClick={() => updatePost(p.id, { is_top: !p.is_top }, p.is_top ? '取消置顶' : '置顶')}>{p.is_top ? '取消置顶' : '置顶'}</button>
                            </>
                          )}
                          {/* 待审核帖：通过 + 拒绝 */}
                          {p.status === 'pending' && (
                            <>
                              <button className="btn-primary !px-2 !py-1 !text-xs" disabled={actionLoading === p.id + '通过'} onClick={() => updatePost(p.id, { status: 'normal' }, '通过')}>通过</button>
                              <button className="btn-danger !px-2 !py-1 !text-xs" disabled={actionLoading === p.id + '拒绝'} onClick={() => updatePost(p.id, { status: 'hidden' }, '拒绝')}>拒绝</button>
                            </>
                          )}
                          {/* 隐藏帖：恢复 */}
                          {p.status === 'hidden' && (
                            <button className="btn-primary !px-2 !py-1 !text-xs" disabled={actionLoading === p.id + '恢复'} onClick={() => updatePost(p.id, { status: 'normal' }, '恢复')}>恢复</button>
                          )}
                          {/* 删除按钮（所有状态都有）*/}
                          <button className="btn-danger !px-2 !py-1 !text-xs" disabled={actionLoading === p.id + 'delete'} onClick={() => deletePost(p.id)}>删除</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
