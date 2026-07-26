'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  /** 弹出一条 toast 提示 */
  show: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// 自增 id
let toastIdSeq = 0;

/**
 * Toast 全局 Provider
 * 包装应用根节点，通过 useToast() 获取 show 方法
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, message: string) => {
      const id = ++toastIdSeq;
      setToasts((list) => [...list, { id, type, message }]);
      // 3 秒自动消失
      window.setTimeout(() => remove(id), 3000);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Toast 容器：右上角垂直堆叠 */}
      <div className="fixed top-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** 单条 Toast 卡片 */
function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const cfg = {
    success: { icon: CheckCircle, color: 'text-success', border: 'border-success/30' },
    error: { icon: XCircle, color: 'text-danger', border: 'border-danger/30' },
    info: { icon: Info, color: 'text-primary-400', border: 'border-primary-500/30' },
  }[toast.type];
  const Icon = cfg.icon;

  return (
    <div
      className={`slide-up flex items-start gap-2 rounded-lg border ${cfg.border} bg-bg-elevated px-3 py-2 shadow-xl`}
    >
      <Icon className={`mt-0.5 shrink-0 ${cfg.color}`} size={16} />
      <p className="flex-1 break-words text-sm text-text-primary">{toast.message}</p>
      <button
        onClick={onClose}
        className="shrink-0 text-text-dim transition-colors hover:text-text-primary"
        aria-label="关闭"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * useToast Hook
 * 必须在 ToastProvider 内使用
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast 必须在 ToastProvider 内使用');
  }
  return ctx;
}
