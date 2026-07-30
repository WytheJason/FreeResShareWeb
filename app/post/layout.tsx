/**
 * 帖子详情页布局
 * 强制动态渲染，避免静态预渲染导致评论区的 Turnstile 初始化异常
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
