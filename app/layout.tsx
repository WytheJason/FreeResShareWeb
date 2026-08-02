/**
 * 全局根布局
 * - 注入全局样式
 * - 渲染顶部导航 + 内容容器 + 底部
 * - 包装 ToastProvider 提供全局弹窗
 */

import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ToastProvider } from '@/components/Toast';

// ============ SEO 元数据 ============
export const metadata: Metadata = {
  title: {
    default: '环梦网盘资源分享论坛',
    template: '%s | 环梦网盘资源分享论坛',
  },
  description:
    '环梦网盘资源分享论坛是专注于软件工具、影视剧集、学习资料等网盘资源分享的社区论坛，提供安全合规的资源发布、楼中楼评论、VIP 会员体系与多层安全防护。',
  keywords: ['网盘资源', '软件分享', '影视资源', '资源论坛', 'VIP会员', '学习资料'],
  authors: [{ name: '环梦网盘资源分享论坛' }],
  openGraph: {
    title: '环梦网盘资源分享论坛',
    description: '安全合规的网盘资源分享社区',
    type: 'website',
    locale: 'zh_CN',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B1220',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-bg-base text-text-primary">
        <ToastProvider>
          {/* 顶部固定导航 */}
          <Navbar />

          {/* 主内容区：顶部留出导航高度（64px） */}
          <main className="mx-auto min-h-[calc(100vh-64px)] max-w-7xl px-4 pb-12 pt-20">
            {children}
          </main>

          {/* 全局底部 */}
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
