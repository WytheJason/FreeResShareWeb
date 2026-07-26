/**
 * 全局 404 兜底页
 */

import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center fade-in">
      {/* 大号 404 */}
      <div className="relative">
        <div className="text-[10rem] font-bold leading-none text-primary-600/20 md:text-[14rem]">
          404
        </div>
        <div className="absolute inset-0 grid place-items-center">
          <Compass className="text-primary-400 animate-pulse" size={64} />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-text-primary">页面未找到</h1>
        <p className="text-text-muted">
          您访问的页面可能已被删除、移动或从未存在
        </p>
      </div>

      <div className="flex gap-3">
        <Link href="/" className="btn-primary">
          <Home size={16} />
          返回首页
        </Link>
      </div>
    </div>
  );
}
