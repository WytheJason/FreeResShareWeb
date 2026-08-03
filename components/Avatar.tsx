'use client';

/**
 * 头像组件
 * - 支持图片加载失败自动降级为首字母
 * - 支持 Supabase Storage URL
 * - 支持任意 URL 或空值
 */
import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  /** 用户名，用于生成首字母兜底 */
  name?: string;
  /** 尺寸类名 */
  className?: string;
  /** 是否显示为链接 */
  href?: string;
}

export default function Avatar({
  src,
  alt,
  name = 'U',
  className = 'h-10 w-10',
  href,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showImg = src && !imgError;
  const fallbackLetter = (name || 'U').charAt(0).toUpperCase();

  const avatarContent = showImg ? (
    <img
      src={src!}
      alt={alt || name}
      className={`${className} shrink-0 rounded-full object-cover`}
      onError={() => setImgError(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <div
      className={`${className} grid shrink-0 place-items-center rounded-full bg-primary-500/20 font-medium text-primary-300`}
    >
      {fallbackLetter}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="inline-block shrink-0">
        {avatarContent}
      </a>
    );
  }

  return avatarContent;
}
