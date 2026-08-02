'use client';

/**
 * 主题切换器
 * - 提供 4 套主题：深空蓝 / 暗夜紫 / 墨玉绿 / 日光白
 * - 通过 <html data-theme="xxx"> 切换，CSS 变量驱动全局配色
 * - 选择写入 localStorage 持久化；同步更新 meta[theme-color]
 * - 防闪烁内联脚本在 layout.tsx 中于首屏前执行，此处仅负责交互
 */

import { useEffect, useRef, useState } from 'react';
import { Palette, Check, Sun, Moon, Sparkles, Leaf, Contrast } from 'lucide-react';

export type ThemeId = 'dark-blue' | 'dark-purple' | 'dark-emerald' | 'black' | 'light';

interface ThemeMeta {
  id: ThemeId;
  name: string;
  desc: string;
  /** 主色色块（用于预览） */
  swatch: string;
  /** 背景色块（用于预览） */
  bg: string;
  /** 是否浅色主题 */
  light?: boolean;
  icon: typeof Sun;
}

// 全部可选主题（顺序即展示顺序）
export const THEMES: ThemeMeta[] = [
  {
    id: 'dark-blue',
    name: '深空蓝',
    desc: '默认 · 科技蓝',
    swatch: '#3B82F6',
    bg: '#0B1220',
    icon: Sparkles,
  },
  {
    id: 'dark-purple',
    name: '暗夜紫',
    desc: '神秘 · 典雅紫',
    swatch: '#A855F7',
    bg: '#160E26',
    icon: Moon,
  },
  {
    id: 'dark-emerald',
    name: '墨玉绿',
    desc: '护眼 · 自然绿',
    swatch: '#10B981',
    bg: '#071310',
    icon: Leaf,
  },
  {
    id: 'black',
    name: '纯黑',
    desc: 'AMOLED · 纯黑省电',
    swatch: '#3B82F6',
    bg: '#000000',
    icon: Contrast,
  },
  {
    id: 'light',
    name: '日光白',
    desc: '明亮 · 简洁白',
    swatch: '#2563EB',
    bg: '#F8FAFC',
    light: true,
    icon: Sun,
  },
];

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: ThemeId = 'dark-blue';

/** 读取当前主题（优先 localStorage，其次 documentElement 属性，兜底默认） */
function readTheme(): ThemeId {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme') as ThemeId | null;
    if (attr && THEMES.some((t) => t.id === attr)) return attr;
  }
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
  }
  return DEFAULT_THEME;
}

/** 应用主题到 <html> 与 localStorage，并同步 meta[theme-color] */
export function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 隐私模式等场景静默忽略
  }
  // 同步浏览器地址栏 / PWA 的 theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = THEMES.find((t) => t.id === theme)?.bg;
  if (meta && bg) meta.setAttribute('content', bg);
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 挂载后读取真实主题（避免 SSR 与客户端不一致）
  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function handleSelect(id: ThemeId) {
    setTheme(id);
    applyTheme(id);
    setOpen(false);
  }

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const CurrentIcon = current.icon;

  return (
    <div ref={wrapRef} className="relative">
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="切换主题"
        title="切换主题"
        className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-bg-surface text-text-secondary transition-colors hover:border-primary-500 hover:text-primary-300"
      >
        {/* 挂载前用占位图标避免 hydration 不一致；挂载后显示当前主题图标 */}
        {mounted ? <CurrentIcon size={16} /> : <Palette size={16} />}
      </button>

      {/* 下拉面板 */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-xl shadow-black/30">
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-text-muted">
            选择主题配色
          </div>
          <ul className="py-1">
            {THEMES.map((t) => {
              const Icon = t.icon;
              const active = t.id === theme;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(t.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-bg-hover ${
                      active ? 'bg-bg-hover' : ''
                    }`}
                  >
                    {/* 色块预览：背景色 + 主色圆点 */}
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border"
                      style={{ backgroundColor: t.bg }}
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: t.swatch }}
                      />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-text-primary">
                        {t.name}
                      </span>
                      <span className="block text-xs text-text-muted">{t.desc}</span>
                    </span>
                    <Icon
                      size={15}
                      className={active ? 'text-primary-400' : 'text-text-dim'}
                    />
                    {active && <Check size={14} className="text-primary-400" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
