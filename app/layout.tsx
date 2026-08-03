/**
 * 全局根布局
 * - 注入全局样式
 * - 渲染顶部导航 + 内容容器 + 底部
 * - 包装 ToastProvider 提供全局弹窗
 */

import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ToastProvider } from '@/components/Toast';

// Google AdSense 发布商 ID（在 Vercel 环境变量中可通过 NEXT_PUBLIC_ADSENSE_CLIENT 覆盖）
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-5863972767779385';

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
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/favicon.svg'],
  },
  // Google AdSense 站点归属验证
  verification: {
    other: {
      'google-adsense-account': ADSENSE_CLIENT,
    },
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
        {/* 主题防闪烁：首屏前同步读取 localStorage 并设置 data-theme，避免主题切换闪屏 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var valid=['dark-blue','dark-purple','dark-emerald','black','light'];var map={'dark-blue':'#0B1220','dark-purple':'#160E26','dark-emerald':'#071310','black':'#000000','light':'#F8FAFC'};var theme=(t&&valid.indexOf(t)>=0)?t:'dark-blue';document.documentElement.setAttribute('data-theme',theme);var m=document.querySelector('meta[name="theme-color"]');if(m&&map[theme])m.setAttribute('content',map[theme]);}catch(e){document.documentElement.setAttribute('data-theme','dark-blue');}})();`,
          }}
        />
        {/* Google AdSense 加载器：全站自动注入，afterInteractive 不阻塞首屏 */}
        <Script
          async
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
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
