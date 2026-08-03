'use client';

import { Trash2, MessageSquare } from 'lucide-react';
import type { Comment } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import Empty from './Empty';
import Avatar from './Avatar';

interface CommentTreeProps {
  /** 评论列表（树形结构） */
  comments: Comment[];
  /** 当前登录用户 id（用于显示删除按钮） */
  currentUserId?: string;
  /** 删除评论回调 */
  onDelete?: (id: string) => void;
  /** 回复评论回调：parentId（根评论 id）、replyToId（被回复评论 id）、replyToNickname（被回复昵称） */
  onReply?: (parentId: string, replyToId: string, replyToNickname: string) => void;
}

/**
 * 楼中楼评论组件
 * 递归渲染嵌套评论，每层左侧缩进 ml-12 + 竖线 border-l
 */
export default function CommentTree({
  comments,
  currentUserId,
  onDelete,
  onReply,
}: CommentTreeProps) {
  if (!comments || comments.length === 0) {
    return <Empty text="暂无评论" />;
  }

  return (
    <ul className="space-y-3">
      {comments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          onDelete={onDelete}
          onReply={onReply}
        />
      ))}
    </ul>
  );
}

interface CommentNodeProps {
  comment: Comment;
  currentUserId?: string;
  onDelete?: (id: string) => void;
  onReply?: (parentId: string, replyToId: string, replyToNickname: string) => void;
}

/** 单条评论节点 */
function CommentNode({
  comment,
  currentUserId,
  onDelete,
  onReply,
}: CommentNodeProps) {
  const isMine = !!currentUserId && comment.user_id === currentUserId;
  const hasChildren = !!comment.children && comment.children.length > 0;

  return (
    <li className="rounded-lg p-3 transition-colors hover:bg-bg-hover/40">
      <div className="flex gap-3">
        {/* 头像 */}
        <Avatar
          src={comment.user_avatar}
          name={comment.user_nickname}
          className="h-8 w-8 shrink-0"
        />

        {/* 内容区 */}
        <div className="min-w-0 flex-1">
          {/* 昵称 + @回复对象 + 时间 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-text-primary">{comment.user_nickname}</span>
            {comment.reply_to_nickname && (
              <>
                <span className="text-text-dim">回复</span>
                <span className="text-primary-400">@{comment.reply_to_nickname}</span>
              </>
            )}
            <span className="text-text-dim">· {formatRelativeTime(comment.created_at)}</span>
          </div>

          {/* 评论内容 */}
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-secondary">
            {comment.content}
          </p>

          {/* 操作区 */}
          <div className="mt-2 flex items-center gap-4 text-xs">
            {onReply && (
              <button
                onClick={() =>
                  onReply(
                    comment.parent_id ?? comment.id,
                    comment.id,
                    comment.user_nickname
                  )
                }
                className="flex items-center gap-1 text-text-dim transition-colors hover:text-primary-300"
              >
                <MessageSquare size={12} />
                回复
              </button>
            )}
            {isMine && onDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-text-dim transition-colors hover:text-danger"
              >
                <Trash2 size={12} />
                删除
              </button>
            )}
          </div>

          {/* 子评论递归：缩进 + 竖线 */}
          {hasChildren && (
            <div className="mt-3 ml-12 border-l border-border-subtle pl-3">
              <CommentTree
                comments={comment.children!}
                currentUserId={currentUserId}
                onDelete={onDelete}
                onReply={onReply}
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
