'use client';

/**
 * Google AdSense 广告位组件
 * --------------------------------------------------
 * - 配合 app/layout.tsx 中全局加载的 adsbygoogle.js 使用
 * - 传入 slot（广告单元 ID）即渲染真实广告；未配置则渲染占位（便于预览广告位位置）
 * - slot 通过 NEXT_PUBLIC_ADSENSE_SLOT_XXX 环境变量配置（构建期注入到前端）
 * - 客户端组件：在 useEffect 中调用 (adsbygoogle = window.adsbygoogle || []).push({})
 *   以支持 Next.js 客户端路由切换后动态初始化广告单元
 * - 兼容广告拦截器：push 失败时静默忽略，不影响页面渲染
 */
import { useEffect, useRef } from 'react';

interface AdSenseProps {
  /** 广告单元 ID（AdSense 后台 > 广告 > 广告单元 > ID） */
  slot?: string;
  /** 广告格式，默认 auto（自动适配） */
  format?: string;
  /** 是否响应式全宽，默认 true */
  responsive?: boolean;
  /** 容器额外类名 */
  className?: string;
  /** 占位/标签文案 */
  label?: string;
}

// AdSense 发布商 ID（与 layout.tsx 中 loader 保持一致）
const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-5863972767779385';

export default function AdSense({
  slot,
  format = 'auto',
  responsive = true,
  className = '',
  label = '广告',
}: AdSenseProps) {
  const pushed = useRef(false);

  // 挂载后推送一次，初始化该 <ins> 广告单元
  useEffect(() => {
    if (!slot || pushed.current) return;
    try {
      const w = window as Window & { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle 未就绪或被广告拦截器阻断，静默忽略
    }
  }, [slot]);

  // 未配置 slot：渲染占位（标记广告位位置，发布后填入 slot 即生效）
  if (!slot) {
    return (
      <div
        className={`my-4 flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-subtle bg-bg-surface/40 py-10 text-center ${className}`}
        aria-label="广告位占位"
      >
        <span className="text-xs font-medium tracking-wide text-text-muted">
          {label}
        </span>
        <span className="text-[11px] text-text-dim">
          AdSense 广告位 · 配置 NEXT_PUBLIC_ADSENSE_SLOT_XXX 后展示
        </span>
      </div>
    );
  }

  // 已配置 slot：渲染真实广告单元
  return (
    <div className={`my-4 ${className}`} aria-label={label}>
      {/* 合规标签：标注此区域为广告 */}
      <div className="mb-1 text-[10px] uppercase tracking-wider text-text-dim">
        {label}
      </div>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
}
