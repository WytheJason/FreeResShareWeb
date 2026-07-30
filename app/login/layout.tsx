/**
 * 登录/注册页布局
 * 强制动态渲染，避免 Next.js 静态预渲染导致 Turnstile 初始化卡死
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
