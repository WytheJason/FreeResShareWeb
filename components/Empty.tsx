import type { ReactNode } from 'react';
import { FolderOpen } from 'lucide-react';

interface EmptyProps {
  /** 空状态文案 */
  text?: string;
  /** 自定义图标 */
  icon?: ReactNode;
}

/**
 * 空状态展示组件
 * 居中布局，默认 FolderOpen 图标 + 文案
 */
export default function Empty({ text = '暂无数据', icon }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center fade-in">
      {icon ?? <FolderOpen className="text-text-dim" size={64} />}
      <p className="mt-3 text-sm text-text-muted">{text}</p>
    </div>
  );
}
