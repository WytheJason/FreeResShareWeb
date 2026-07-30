/**
 * 个人中心页布局
 * 强制动态渲染，避免静态预渲染导致资料编辑的 Turnstile 初始化异常
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
