'use client';

/**
 * 帖子详情客户端组件
 * - 面包屑
 * - 帖子主体（PostHeader）
 * - 网盘资源（ResourceCard，权限分态）
 * - 操作栏（收藏/举报/作者编辑删除）
 * - 评论区（CommentSection）
 * - 举报对话框
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Star, StarOff, Flag, Edit, Trash2, ChevronRight, X } from 'lucide-react';
import type { PostDetail, Comment, PageResult, UserProfile } from '@/lib/types';
import { useToast } from '@/components/Toast';
import AdBanner from '@/components/AdBanner';
import PostHeader from './PostHeader';
import ResourceCard from './ResourceCard';
import CommentSection from './CommentSection';

interface PostDetailClientProps {
  post: PostDetail;
  comments: PageResult<Comment>;
  currentUser: UserProfile | null;
}

export default function PostDetailClient({
  post,
  comments,
  currentUser,
}: PostDetailClientProps) {
  const router = useRouter();
  const toast = useToast();

  // 收藏状态
  const [collected, setCollected] = useState(post.is_collected);
  // 举报对话框
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // ===== 收藏 / 取消收藏 =====
  async function handleCollect() {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    const prev = collected;
    setCollected(!prev); // 乐观更新
    try {
      const res = await fetch('/api/collect/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      });
      const json = await res.json();
      if (json.code !== 0) {
        setCollected(prev);
        toast.show('error', json.message || '操作失败');
      } else {
        toast.show('success', json.message);
      }
    } catch {
      setCollected(prev);
      toast.show('error', '网络异常');
    }
  }

  // ===== 提交举报 =====
  async function handleReportSubmit() {
    if (!reportReason.trim()) {
      toast.show('error', '请填写举报理由');
      return;
    }
    setReportSubmitting(true);
    try {
      const res = await fetch('/api/report/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, reason: reportReason }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', '举报已提交');
        setReportOpen(false);
        setReportReason('');
      } else {
        toast.show('error', json.message || '提交失败');
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setReportSubmitting(false);
    }
  }

  // ===== 删除帖子 =====
  async function handleDeletePost() {
    if (!window.confirm('确定删除该帖子吗？删除后不可恢复')) return;
    try {
      const res = await fetch('/api/post/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', '删除成功');
        // 先刷新再跳转，确保首页服务端组件重新拉取数据
        router.refresh();
        setTimeout(() => {
          router.push('/');
          // 跳转后再次刷新，双重保险
          setTimeout(() => router.refresh(), 50);
        }, 50);
      } else {
        toast.show('error', json.message || '删除失败');
      }
    } catch {
      toast.show('error', '网络异常');
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* 面包屑 */}
      <nav className="flex items-center gap-1 text-sm text-text-muted">
        <Link href="/" className="hover:text-primary-300">首页</Link>
        <ChevronRight size={14} />
        <span className="text-text-secondary">
          {post.category === 'software' ? '软件工具' : '影视剧集'}
        </span>
        <ChevronRight size={14} />
        <span className="truncate text-text-dim">{post.title}</span>
      </nav>

      {/* 帖子主体 */}
      <PostHeader post={post} />

      {/* 广告位：帖子下方 */}
      <AdBanner />

      {/* 网盘资源 */}
      <section>
        <h2 className="section-title mb-3">网盘资源</h2>
        <ResourceCard post={post} currentUser={currentUser} />
      </section>

      {/* 操作栏 */}
      {currentUser && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleCollect} className="btn-secondary">
            {collected ? <StarOff size={16} /> : <Star size={16} />}
            {collected ? '已收藏' : '收藏'}
          </button>
          <button onClick={() => setReportOpen(true)} className="btn-secondary">
            <Flag size={16} />
            举报
          </button>
          {post.is_author && (
            <>
              <Link href={`/publish?id=${post.id}`} className="btn-secondary">
                <Edit size={16} />
                编辑
              </Link>
              <button onClick={handleDeletePost} className="btn-danger">
                <Trash2 size={16} />
                删除
              </button>
            </>
          )}
        </div>
      )}

      {/* 广告位：资源与评论之间 */}
      <AdBanner />

      {/* 评论区 */}
      <CommentSection
        postId={post.id}
        currentUser={currentUser}
        initialComments={comments}
      />

      {/* 举报对话框 */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 fade-in">
          <div className="card w-full max-w-md p-5 slide-up">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">举报该帖子</h3>
              <button
                onClick={() => setReportOpen(false)}
                className="text-text-dim hover:text-text-primary"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="请填写举报理由（1-500 字）"
              maxLength={500}
              className="input-field mt-4 min-h-[120px] resize-y"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setReportOpen(false)} className="btn-secondary">
                取消
              </button>
              <button
                onClick={handleReportSubmit}
                disabled={reportSubmitting}
                className="btn-danger"
              >
                {reportSubmitting ? '提交中...' : '提交举报'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
