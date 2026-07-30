/**
 * 发布资源页布局
 * 强制动态渲染，避免 Next.js 静态预渲染导致 Turnstile 初始化卡死
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PublishLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
