'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { PostCategory } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';

interface SearchBoxProps {
  /** 初始关键词（来自 URL searchParams） */
  initialKeyword?: string;
  /** 初始分类（来自 URL searchParams） */
  initialCategory?: PostCategory;
  /** 当前 URL 的查询字符串（用于在切换分类时保留其他参数） */
  currentSearch?: string;
  /** 跳转基础路径，默认 '/' */
  basePath?: string;
}

/**
 * 首页搜索框 + 分类筛选（URL 驱动）
 * - 提交搜索：跳转到 `/?keyword=xxx`（重置 page）
 * - 切换分类：跳转到 `/?category=xxx`（保留 keyword，重置 page）
 * - 选择"全部"分类：删除 category 参数
 */
export default function SearchBox({
  initialKeyword = '',
  initialCategory,
  currentSearch = '',
  basePath = '/',
}: SearchBoxProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(initialKeyword);

  // 构建并跳转新 URL
  function pushUrl(next: { keyword?: string; category?: PostCategory | '' }) {
    const params = new URLSearchParams(currentSearch);
    if (next.keyword !== undefined) {
      if (next.keyword) params.set('keyword', next.keyword);
      else params.delete('keyword');
    }
    if (next.category !== undefined) {
      if (next.category) params.set('category', next.category);
      else params.delete('category');
    }
    // 切换搜索条件时重置分页
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    pushUrl({ keyword: keyword.trim() });
  }

  function handleCategory(cat: PostCategory | '') {
    pushUrl({ category: cat });
  }

  // 分类选项
  const options: { value: PostCategory | ''; label: string }[] = [
    { value: '', label: '全部' },
    { value: 'software', label: CATEGORY_LABELS.software },
    { value: 'movie', label: CATEGORY_LABELS.movie },
  ];

  return (
    <div className="w-full">
      {/* 搜索表单 */}
      <form
        onSubmit={handleSearch}
        className="flex w-full items-center gap-2 rounded-xl border border-border-subtle bg-bg-surface/80 p-1.5 backdrop-blur"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center text-text-muted">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索资源标题..."
          className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-dim focus:outline-none"
          aria-label="搜索关键词"
        />
        <button type="submit" className="btn-primary shrink-0">
          搜索
        </button>
      </form>

      {/* 分类筛选 - 单选按钮组 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-dim">分类：</span>
        {options.map((opt) => {
          const active = (initialCategory ?? '') === opt.value;
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => handleCategory(opt.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary-600 text-white'
                  : 'border border-border bg-bg-surface text-text-secondary hover:border-primary-500/50 hover:text-primary-300'
              }`}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
