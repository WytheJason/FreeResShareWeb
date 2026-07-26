/**
 * 骨架屏组件
 * 使用全局 .skeleton shimmer 动画类
 */

/** 帖子卡片骨架屏：封面 + 标题 + 简介 + 底部信息 */
export function PostCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      {/* 封面占位 */}
      <div className="skeleton aspect-video w-full" />
      <div className="p-4 space-y-3">
        {/* 标题占位 */}
        <div className="skeleton h-5 w-3/4 rounded" />
        {/* 简介占位 */}
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        {/* 底部信息占位 */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <div className="skeleton h-6 w-6 rounded-full" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  );
}

/** 评论骨架屏：头像 + 多行文字 */
export function CommentSkeleton() {
  return (
    <div className="flex gap-3 py-3">
      <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-3/4 rounded" />
      </div>
    </div>
  );
}

/** 用户卡片骨架屏：头像 + 昵称 + 副信息 */
export function UserCardSkeleton() {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="skeleton h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}
