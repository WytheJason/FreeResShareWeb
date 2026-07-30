'use client';

/**
 * 评论区组件
 * - 评论输入（极验校验 + 回复模式）
 * - 评论列表（CommentTree 楼中楼）
 * - 分页（切换时滚动到评论区顶部）
 * - 自管理状态，仅依赖 postId / currentUser / 初始评论数据
 */

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, Send } from 'lucide-react';
import type { Comment, PageResult, UserProfile } from '@/lib/types';
import CommentTree from '@/components/CommentTree';
import TurnstileWidget, { type TurnstileWidgetHandle } from '@/components/TurnstileWidget';
import Pagination from '@/components/Pagination';
import Empty from '@/components/Empty';
import { useToast } from '@/components/Toast';

interface CommentSectionProps {
  postId: string;
  currentUser: UserProfile | null;
  initialComments: PageResult<Comment>;
}

export default function CommentSection({
  postId,
  currentUser,
  initialComments,
}: CommentSectionProps) {
  const router = useRouter();
  const toast = useToast();
  const sectionRef = useRef<HTMLDivElement>(null);

  const [comments, setComments] = useState<PageResult<Comment>>(initialComments);
  const [content, setContent] = useState('');
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const [replyInfo, setReplyInfo] = useState<{
    parentId: string;
    replyToId: string;
    replyToNickname: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 拉取评论分页
  async function fetchComments(page: number) {
    try {
      const res = await fetch(
        `/api/comment/list?post_id=${postId}&page=${page}&page_size=20`
      );
      const json = await res.json();
      if (json.code === 0 && json.data) {
        setComments(json.data as PageResult<Comment>);
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {
      toast.show('error', '评论加载失败');
    }
  }

  // 提交评论
  async function handleSubmit() {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (!content.trim()) {
      toast.show('error', '请输入评论内容');
      return;
    }
    setSubmitting(true);
    try {
      const token = await turnstileRef.current?.getToken();
      if (!token) {
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/comment/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          content,
          parent_id: replyInfo?.parentId ?? null,
          reply_to_id: replyInfo?.replyToId ?? null,
          captcha: { type: 'turnstile', token },
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', '评论成功');
        setContent('');
        setReplyInfo(null);
        turnstileRef.current?.reset();
        await fetchComments(comments.page);
      } else {
        toast.show('error', json.message || '评论失败');
        turnstileRef.current?.reset();
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setSubmitting(false);
    }
  }

  // 点击回复
  function handleReply(parentId: string, replyToId: string, replyToNickname: string) {
    setReplyInfo({ parentId, replyToId, replyToNickname });
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 删除评论
  async function handleDelete(id: string) {
    if (!window.confirm('确定删除该评论吗？')) return;
    try {
      const res = await fetch('/api/comment/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', '删除成功');
        await fetchComments(comments.page);
      } else {
        toast.show('error', json.message || '删除失败');
      }
    } catch {
      toast.show('error', '网络异常');
    }
  }

  return (
    <section ref={sectionRef}>
      <h2 className="section-title mb-3">
        评论区 <span className="text-text-dim">（{comments.total}）</span>
      </h2>

      {/* 评论输入 */}
      {currentUser ? (
        <div className="card mb-4 p-4">
          {replyInfo && (
            <div className="mb-2 flex items-center justify-between rounded-md bg-bg-elevated px-3 py-1.5 text-xs">
              <span className="text-text-muted">
                回复 <span className="text-primary-400">@{replyInfo.replyToNickname}</span>
              </span>
              <button
                onClick={() => setReplyInfo(null)}
                className="text-text-dim hover:text-text-primary"
                aria-label="取消回复"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="说点什么..."
            maxLength={500}
            className="input-field min-h-[80px] resize-y"
          />
          <div className="mt-3 flex items-center justify-between">
            <TurnstileWidget
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onSuccess={() => {}}
            />
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              <Send size={14} />
              {submitting ? '提交中...' : '发布'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card mb-4 p-4 text-center text-sm text-text-muted">
          <Link href="/login" className="link">登录</Link>
          后参与评论
        </div>
      )}

      {/* 评论列表 */}
      <div className="card p-4">
        {comments.list.length > 0 ? (
          <>
            <CommentTree
              comments={comments.list}
              currentUserId={currentUser?.id}
              onDelete={handleDelete}
              onReply={handleReply}
            />
            <div className="mt-4 flex justify-center">
              <Pagination
                page={comments.page}
                totalPages={comments.total_pages}
                onChange={fetchComments}
              />
            </div>
          </>
        ) : (
          <Empty text="暂无评论，快来抢沙发" />
        )}
      </div>
    </section>
  );
}
