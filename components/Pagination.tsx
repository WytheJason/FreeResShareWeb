'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  /** 当前页 */
  page: number;
  /** 总页数 */
  totalPages: number;
  /** 翻页回调 */
  onChange: (page: number) => void;
}

/**
 * 计算需要显示的页码列表
 * - 总页数 ≤ 5：显示全部
 * - 总页数 > 5：始终显示首页和末页，中间显示当前页附近 3 页，超出用省略号
 */
function calcPages(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const result: (number | 'ellipsis')[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);

  if (left > 2) result.push('ellipsis');
  for (let i = left; i <= right; i++) result.push(i);
  if (right < totalPages - 1) result.push('ellipsis');

  result.push(totalPages);
  return result;
}

/**
 * 分页组件
 * 上一页/下一页 + 页码（最多 5 个，超出省略号）
 */
export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = calcPages(page, totalPages);
  const btnBase =
    'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-sm transition-colors';

  return (
    <nav className="flex items-center gap-1" aria-label="分页">
      {/* 上一页 */}
      <button
        className={`${btnBase} border border-border text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40`}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="上一页"
      >
        <ChevronLeft size={14} />
      </button>

      {/* 页码 */}
      {pages.map((p, idx) =>
        p === 'ellipsis' ? (
          <span key={`e-${idx}`} className={`${btnBase} text-text-dim`}>
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`${btnBase} ${
              p === page
                ? 'bg-primary-600 text-white'
                : 'border border-border text-text-secondary hover:bg-bg-hover'
            }`}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      {/* 下一页 */}
      <button
        className={`${btnBase} border border-border text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40`}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="下一页"
      >
        <ChevronRight size={14} />
      </button>
    </nav>
  );
}
