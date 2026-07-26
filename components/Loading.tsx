import { Loader2 } from 'lucide-react';

/**
 * 全屏居中加载层
 * fixed inset-0 grid place-items-center，遮罩 + spinner
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-bg-base/80 backdrop-blur z-50">
      <Loader2 className="animate-spin text-primary-500" size={48} />
    </div>
  );
}

/**
 * 内联小尺寸 spinner
 * 用于按钮内或文本旁的加载指示
 */
export function Spinner() {
  return <Loader2 className="inline animate-spin text-primary-500" size={16} />;
}
