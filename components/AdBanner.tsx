'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Google AdSense 广告位组件
 *
 * 支持两种模式：
 * 1. 自动广告模式（默认）：不传 adSlotId，由 Google 自动决定投放
 *    - 需要在 AdSense 后台开启「自动广告」开关
 *    - 站点必须处于「已通过」状态
 *
 * 2. 手动广告单元模式：传入 adSlotId，渲染指定广告单元
 *    - 在 AdSense 后台创建广告单元后获取 ad-slot ID
 *    - 例如：<AdBanner adSlotId="1234567890" />
 */

interface AdBannerProps {
  /** AdSense 广告单元 ID（仅手动模式需要，如 ca-pub-xxxxx/1234567890） */
  adSlotId?: string;
  /** 广告位布局（仅手动模式生效） */
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  /** 容器自定义 class */
  className?: string;
  /** VIP 用户是否隐藏该广告位 */
  hideForVip?: boolean;
}

// 发布商 ID（与 layout.tsx 中的 ADSENSE_CLIENT 保持一致）
const PUB_ID = 'ca-pub-5863972767779385';

export default function AdBanner({
  adSlotId,
  format = 'auto',
  className = '',
  hideForVip = true,
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // 服务端渲染期间不执行
    if (typeof window === 'undefined') return;

    // 检查是否为 VIP 用户（从 localStorage 读取 VIP 状态）
    if (hideForVip) {
      try {
        const vipInfo = localStorage.getItem('vip_info');
        if (vipInfo) {
          const parsed = JSON.parse(vipInfo);
          if (parsed?.is_vip && parsed?.vip_expired_at) {
            const expireTime = new Date(parsed.vip_expired_at).getTime();
            if (expireTime > Date.now()) {
              setVisible(false);
              return;
            }
          }
        }
      } catch {
        // 忽略解析错误，继续显示广告
      }
    }

    // 等待 Google AdSense 脚本加载完成
    const tryLoadAd = () => {
      try {
        // @ts-expect-error - adsbygoogle 由 Google 脚本注入
        if (window.adsbygoogle) {
          // @ts-expect-error - 异步队列推入广告请求
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } else {
          // 脚本未就绪，稍后重试
          setTimeout(tryLoadAd, 300);
        }
      } catch (e) {
        // 广告加载失败，静默处理（不影响页面）
        console.debug('[AdSense] 广告加载失败:', e);
      }
    };

    // 延迟一点等待 DOM 就绪
    const timer = setTimeout(tryLoadAd, 500);
    return () => clearTimeout(timer);
  }, [adSlotId, hideForVip]);

  if (!visible) return null;

  // 手动模式：渲染指定广告单元
  if (adSlotId) {
    return (
      <div
        className={`ad-banner-container my-4 overflow-hidden rounded-lg border border-border bg-bg-surface ${className}`}
        data-ad-client={PUB_ID}
        data-ad-slot={adSlotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      >
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={PUB_ID}
          data-ad-slot={adSlotId}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // 自动广告模式：留出容器供 Google 自动注入
  return (
    <div
      className={`ad-banner-container my-4 flex h-[90px] items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-bg-surface/50 ${className}`}
      data-ad-client={PUB_ID}
      data-ad-format="auto"
      data-full-width-responsive="true"
      aria-label="广告位"
      role="complementary"
    >
      <span className="text-xs text-text-muted">广告位 · Advertisement</span>
    </div>
  );
}
