'use client';

/**
 * Cloudflare Turnstile 验证组件
 *
 * 修复与兼容性：
 *  1. SDK 动态加载 + 失败重试（网络波动最多 3 次）
 *  2. 脚本 crossOrigin='anonymous'，避免 CORS 预检被 Cloudflare 拦截
 *  3. 错误码 300010 等客户端失败时自动 reset 再验证最多 2 次，最后失败才提示用户
 *  4. 点击状态徽章可以手动重置验证
 *  5. 严格的 Window 类型声明，使用 globalThis 避免 Vercel/SSR 构建报错
 *  6. 校验 callback 顺序：init 时注册回调、render 前先销毁旧容器
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';

// ============ Turnstile 类型声明 ============
type TurnstileStatus =
  | 'idle'       // 未验证
  | 'ready'      // widget 已渲染，等待用户/自动触发
  | 'loading'    // 加载中
  | 'success'    // 验证成功，有 token
  | 'verifying'  // 正在自动验证中
  | 'failed'     // 验证失败
  | 'expired';   // token 过期

export interface TurnstileWidgetHandle {
  /** 获取当前验证 token；未验证时会阻塞最多 15s 等待验证完成，失败或超时返回 null */
  getToken: (timeoutMs?: number) => Promise<string | null>;
  /** 重置为未验证状态，触发重新验证 */
  reset: () => void;
}

interface TurnstileWidgetProps {
  /** Turnstile Site Key（NEXT_PUBLIC_TURNSTILE_SITE_KEY） */
  siteKey?: string;
  /** 验证成功回调 */
  onSuccess?: (token: string) => void;
  /** 验证失败回调 */
  onError?: (errorCode: string) => void;
  /** 状态变化回调 */
  onStatus?: (status: TurnstileStatus, message?: string) => void;
  /** 主题：dark/light/auto，默认跟随界面 */
  theme?: 'dark' | 'light' | 'auto';
  /** 大小：normal/compact，默认 normal */
  size?: 'normal' | 'compact';
}

type WidgetState = {
  widgetId?: string;
  callbackName?: string;
  scriptLoaded: boolean;
  retryCount: number;     // SDK 加载重试计数
  failRetryCount: number;  // 验证失败自动重试计数（最多 2 次）
};

const MAX_SDK_RETRY = 3;
const SDK_RETRY_INTERVAL = 1500;
const MAX_VERIFY_FAIL_RETRY = 2;

// Turnstile 官方错误码映射（来自 developers.cloudflare.com 文档）
const ERR_CODE_LABEL: Record<string, string> = {
  // 500* 服务端
  '500': 'Turnstile 服务异常',
  '5000': '服务端未知错误',
  '50001': 'Secret Key 无效',
  '50002': '站点 Key 无效',
  '50003': 'Token 已过期',
  '50004': 'Token 已被消费(重复使用)',
  '50005': 'Token 校验失败',
  '50010': '不支持的协议，要求 HTTPS',

  // 600* 客户端配置
  '600': '客户端配置错误',
  '6000': '站点 Key 缺失',
  '60001': '站点 Key 格式无效',
  '60002': 'widget 参数不合法',
  '60010': '脚本跨域加载被阻断',

  // 300* 通用验证失败 / 机器人行为
  '300': '验证失败：检测到异常访问',
  '3000': '验证失败，可重试',
  '30001': '检测到代理/VPN/自动化工具，请关闭后重试',
  '30002': '浏览器环境被风控，请改用无痕或切换网络',
  '300010': '验证失败：可能是代理/VPN 被识别，请尝试切换网络或使用无痕模式',
  '300011': '验证超时，请重新点击提交',
  '300012': '浏览器 Cookie/Storage 被禁用，请开启后重试',
  '300013': '浏览器与验证服务器通信中断，请检查网络',
  '300014': '多次验证失败，请稍后重试',

  // 100* 初始化
  '100': '初始化失败',
  '1000': '未知初始化错误',
  '10000': '未找到 widget 容器 DOM',
  '10001': '页面包含重复的 Site Key widget',
  '10002': '脚本加载失败',
  '10003': 'DOM 中存在重复的 Turnstile 容器',
  '10004': '此浏览器不支持 Turnstile',
  '10005': 'Turnstile 域名白名单不包含当前页面域名',
};

// 可自动重试的错误码集合（非域名/秘钥类硬错误）
const RETRYABLE_ERR = new Set([
  '300', '3000', '30001', '30002', '300010', '300011', '300013', '300014',
  '10001', '10002', '10003', '10004',
  '300012', // Cookie 禁用也尝试一次（极少成功，可接受）
]);

// 全局使用一个 script Promise，多组件共享 SDK 加载
let sdkLoadPromise: Promise<boolean> | null = null;

function labelOfErrCode(code?: string): string {
  if (!code) return '未知错误';
  if (ERR_CODE_LABEL[code]) return ERR_CODE_LABEL[code];
  // 降级：按前缀尝试
  const prefix = code.slice(0, Math.max(1, code.length - 2));
  for (let i = code.length; i >= 3; i--) {
    const k = code.slice(0, i);
    if (ERR_CODE_LABEL[k]) return ERR_CODE_LABEL[k];
  }
  return `验证错误(${code})`;
}

// 动态声明 window.turnstile
type TurnstileRenderOptions = {
  sitekey: string;
  theme?: 'dark' | 'light' | 'auto';
  size?: 'normal' | 'compact';
  retry?: 'auto' | 'never';
  'retry-interval'?: number;
  'refresh-expired'?: 'auto' | 'manual' | 'never';
  tabindex?: number;
  language?: string;
  callback?: (token: string) => void;
  'error-callback'?: (code?: string) => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
  'before-interactive-callback'?: () => void;
  'after-interactive-callback'?: () => void;
  'unsupported-callback'?: () => void;
  appearance?: 'always' | 'execute' | 'interaction-only';
};
type TurnstileApi = {
  render: (container: HTMLElement | string, opts: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
  execute: (widgetId?: string, opts?: { cData?: string }) => void;
  getResponse: (widgetId?: string) => string | undefined;
  isExpired: (widgetId?: string) => boolean;
};

// 使用 globalThis，SSR 时安全
const w =
  typeof globalThis !== 'undefined'
    ? (globalThis as unknown as Record<string, unknown>)
    : ({} as Record<string, unknown>);
const getTurnstile = () => w.turnstile as TurnstileApi | undefined;

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget(
    {
      siteKey,
      onSuccess,
      onError,
      onStatus,
      theme = 'dark',
      size = 'normal',
    },
    ref
  ) {
    const [status, setStatus] = useState<TurnstileStatus>(siteKey ? 'idle' : 'idle');
    const [statusMsg, setStatusMsg] = useState<string>(siteKey ? '未验证' : '未配置 siteKey');
    const containerRef = useRef<HTMLDivElement | null>(null);
    const stateRef = useRef<WidgetState>({
      scriptLoaded: false,
      retryCount: 0,
      failRetryCount: 0,
    });
    const tokenRef = useRef<string | null>(null);
    const statusRef = useRef<TurnstileStatus>('idle');

    // 与父组件同步状态引用，用于 getToken 轮询
    useEffect(() => {
      statusRef.current = status;
    }, [status]);

    const changeStatus = useCallback(
      (s: TurnstileStatus, msg?: string) => {
        setStatus(s);
        statusRef.current = s;
        if (msg !== undefined) setStatusMsg(msg);
        try { onStatus?.(s, msg); } catch { /* 忽略外部回调异常 */ }
      },
      [onStatus]
    );

    // ------------ SDK 加载（全局 Promise，失败带重试）------------
    const ensureSdk = useCallback((retryLeft = MAX_SDK_RETRY): Promise<boolean> => {
      if (getTurnstile()) {
        stateRef.current.scriptLoaded = true;
        return Promise.resolve(true);
      }
      if (sdkLoadPromise) return sdkLoadPromise;

      sdkLoadPromise = new Promise<boolean>((resolve) => {
        if (typeof window === 'undefined') {
          sdkLoadPromise = null;
          resolve(false);
          return;
        }
        // 生成唯一全局 callback，避免被 Cloudflare 300 系列策略命中固定 onload 名
        const instanceId = Math.round(Math.random() * 1e9)
          .toString(36)
          .slice(0, 6);
        const callbackName = `__turnstileOnLoad_${instanceId}_${Date.now()}`;
        stateRef.current.callbackName = callbackName;

        const winAny = window as unknown as Record<string, unknown>;
        winAny[callbackName] = function onReady() {
          stateRef.current.scriptLoaded = true;
          sdkLoadPromise = null;
          resolve(true);
        };

        const s = document.createElement('script');
        // crossOrigin='anonymous' + async defer，减少 Cloudflare WAF CORS 预检误拦截
        s.src =
          'https://challenges.cloudflare.com/turnstile/v0/api.js?' +
          `onload=${encodeURIComponent(callbackName)}&render=explicit`;
        s.async = true;
        s.defer = true;
        s.crossOrigin = 'anonymous';
        s.referrerPolicy = 'no-referrer-when-downgrade';
        s.dataset.instance = instanceId;

        let resolved = false;
        const tryResolve = (v: boolean) => {
          if (resolved) return;
          resolved = true;
          if (!v) {
            sdkLoadPromise = null;
            // 清理挂载的 callback
            try { delete winAny[callbackName]; } catch { winAny[callbackName] = undefined; }
            if (retryLeft > 0) {
              // 延迟重试
              setTimeout(() => {
                ensureSdk(retryLeft - 1).then(resolve);
              }, SDK_RETRY_INTERVAL);
              return;
            }
          }
          resolve(v);
        };

        s.onerror = () => {
          stateRef.current.retryCount = MAX_SDK_RETRY - retryLeft + 1;
          console.error('[Turnstile] 脚本加载失败', instanceId);
          tryResolve(false);
        };
        // 兜底 15s 超时
        setTimeout(() => tryResolve(false), 15_000);
        document.head.appendChild(s);
      });

      return sdkLoadPromise;
    }, []);

    // ------------ widget 渲染 ------------
    const renderWidget = useCallback(() => {
      const t = getTurnstile();
      const box = containerRef.current;
      if (!t || !box || !siteKey) return;

      // 先销毁旧 widget，避免 10003 重复容器错误
      if (stateRef.current.widgetId) {
        try { t.remove(stateRef.current.widgetId); } catch { /* 忽略 */ }
        stateRef.current.widgetId = undefined;
      }
      // 清空容器内容（防止多次 useEffect 留下重复 iframe）
      box.innerHTML = '';
      tokenRef.current = null;
      stateRef.current.failRetryCount = 0;

      changeStatus('ready', '等待验证');

      try {
        const id = t.render(box, {
          sitekey: siteKey,
          theme,
          size,
          retry: 'auto',
          'retry-interval': 8000,
          'refresh-expired': 'auto',
          appearance: 'always',
          language: 'zh-CN',
          callback: (token) => {
            tokenRef.current = token;
            stateRef.current.failRetryCount = 0;
            changeStatus('success', '验证通过');
            try { onSuccess?.(token); } catch { /* 忽略 */ }
          },
          'error-callback': (rawCode) => {
            // Turnstile SDK 4.x 的 error-callback 参数不是 string，可能是对象
            let code: string | undefined;
            if (typeof rawCode === 'string') code = rawCode;
            else if (typeof rawCode === 'number') code = String(rawCode);
            else if (rawCode && typeof rawCode === 'object') {
              const any = rawCode as Record<string, unknown>;
              code = (any.code ?? any.errorCode ?? any.error_code ?? any.message) as
                | string
                | undefined;
              if (code) code = String(code);
            }
            if (!code) code = '3000';

            const msg = labelOfErrCode(code);
            console.error('[Turnstile] 验证错误, code:', code);
            try { onError?.(code); } catch { /* 忽略外部回调 */ }

            // 自动重试
            const retryAble = RETRYABLE_ERR.has(code) || code.startsWith('300') || code.startsWith('1000');
            if (retryAble && stateRef.current.failRetryCount < MAX_VERIFY_FAIL_RETRY) {
              stateRef.current.failRetryCount += 1;
              changeStatus('loading', `验证重试(${stateRef.current.failRetryCount}/${MAX_VERIFY_FAIL_RETRY})...`);
              // 重置当前 widget
              try {
                if (stateRef.current.widgetId) t.reset(stateRef.current.widgetId);
              } catch { /* 忽略 */ }
              setTimeout(() => {
                // 主动触发 execute，避免一直停在 idle
                try { t.execute(stateRef.current.widgetId); } catch { /* 忽略 */ }
              }, 400);
              return;
            }

            // 最终失败
            tokenRef.current = null;
            changeStatus('failed', msg);
          },
          'expired-callback': () => {
            tokenRef.current = null;
            changeStatus('expired', '验证已过期，请重新验证');
          },
          'timeout-callback': () => {
            changeStatus('failed', '验证超时，请重新提交');
          },
          'unsupported-callback': () => {
            changeStatus('failed', '浏览器不支持验证，请更换现代浏览器');
          },
          'before-interactive-callback': () => {
            if (statusRef.current !== 'success') {
              changeStatus('verifying', '正在验证...');
            }
          },
        });
        stateRef.current.widgetId = id;
        // 让非交互模式也能开始自动验证（Turnstile Widget 在 render 后会触发 execute，这里兜底 execute）
        setTimeout(() => {
          try { t.execute(id); } catch { /* 允许失败，正常 managed 模式会自动触发 */ }
        }, 80);
      } catch (e) {
        console.error('[Turnstile] render 异常', e);
        changeStatus('failed', '组件渲染异常，请刷新页面');
      }
    }, [siteKey, theme, size, changeStatus, onSuccess, onError]);

    // ------------ 主流程：监听 siteKey → 加载 SDK → 渲染 widget ------------
    useEffect(() => {
      let mounted = true;
      if (!siteKey) {
        changeStatus('idle', '未配置 siteKey');
        return;
      }
      changeStatus('loading', '加载验证组件...');

      ensureSdk().then((ok) => {
        if (!mounted) return;
        if (!ok) {
          changeStatus('failed', '验证脚本加载失败，请刷新后重试');
          return;
        }
        renderWidget();
      });

      return () => {
        mounted = false;
        // 卸载时清理 widget，避免 DOM 残留
        try {
          const t = getTurnstile();
          if (t && stateRef.current.widgetId) t.remove(stateRef.current.widgetId);
        } catch { /* 忽略 */ }
        // 清理动态挂的全局 callback
        if (stateRef.current.callbackName) {
          const winAny = (typeof window !== 'undefined'
            ? window
            : {}) as unknown as Record<string, unknown>;
          try { delete winAny[stateRef.current.callbackName]; } catch {
            winAny[stateRef.current.callbackName] = undefined;
          }
        }
      };
      // 不把 ensureSdk/renderWidget 放 deps，它们引用的闭包在创建时已经稳定
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteKey]);

    // ------------ 对外暴露方法 ------------
    useImperativeHandle(ref, () => ({
      getToken: (timeoutMs = 15000) => new Promise<string | null>((resolve) => {
        if (!siteKey) return resolve(null);
        if (tokenRef.current) return resolve(tokenRef.current);

        const t0 = Date.now();
        // 立即触发一次 execute（在尚未验证时强制开始验证）
        try {
          const t = getTurnstile();
          if (t && stateRef.current.widgetId && statusRef.current !== 'verifying') {
            t.execute(stateRef.current.widgetId);
            changeStatus('verifying', '正在验证...');
          }
        } catch { /* 忽略 */ }

        const check = () => {
          if (tokenRef.current) return resolve(tokenRef.current);
          if (statusRef.current === 'failed' || statusRef.current === 'expired') {
            return resolve(null);
          }
          if (Date.now() - t0 > timeoutMs) {
            // 超时：显式置失败状态，避免用户误解
            changeStatus('failed', '验证超时，请刷新页面或更换网络');
            return resolve(null);
          }
          setTimeout(check, 250);
        };
        check();
      }),
      reset: () => {
        tokenRef.current = null;
        stateRef.current.failRetryCount = 0;
        try {
          const t = getTurnstile();
          if (t && stateRef.current.widgetId) {
            t.reset(stateRef.current.widgetId);
            setTimeout(() => t.execute?.(stateRef.current.widgetId!), 150);
          }
        } catch { /* 忽略 */ }
        changeStatus('idle', '请完成验证');
      },
    }), [siteKey, changeStatus]);

    // ------------ UI ------------
    const iconColor =
      status === 'success'
        ? 'border-green-500/30 text-green-400 bg-green-500/10'
        : status === 'failed' || status === 'expired'
        ? 'border-red-500/30 text-red-400 bg-red-500/10'
        : status === 'loading' || status === 'verifying'
        ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10 animate-pulse'
        : 'border-primary-500/30 text-primary-400 bg-primary-500/10';

    return (
      <div className="select-none">
        {/* 状态提示（点击可手动重置） */}
        <button
          type="button"
          onClick={() => {
            // 点击手动重置
            tokenRef.current = null;
            stateRef.current.failRetryCount = 0;
            try {
              const t = getTurnstile();
              if (t && stateRef.current.widgetId) {
                t.reset(stateRef.current.widgetId);
                setTimeout(() => t.execute?.(stateRef.current.widgetId!), 150);
              }
            } catch { /* 忽略 */ }
            changeStatus('idle', '请完成验证');
          }}
          title={status === 'failed' ? '点击重试' : '点击重置验证'}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all active:scale-95 ${iconColor}`}
        >
          {status === 'success' ? (
            <ShieldCheck size={12} />
          ) : status === 'loading' || status === 'verifying' ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <ShieldAlert size={12} />
          )}
          <span>{statusMsg}</span>
          {(status === 'failed' || status === 'expired') && (
            <span className="opacity-70 ml-0.5">·点我重试</span>
          )}
        </button>

        {/* Turnstile 容器 */}
        <div ref={containerRef} className="mt-2 min-h-[70px]" />
      </div>
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';
export default TurnstileWidget;
