'use client';

import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

type TurnstileStatus = 'idle' | 'loading' | 'success' | 'failed';

interface TurnstileWidgetProps {
  siteKey?: string;
  onSuccess?: (token: string) => void;
  onError?: (error: string) => void;
  onStatus?: (status: TurnstileStatus) => void;
}

export interface TurnstileWidgetHandle {
  getToken: () => Promise<string | null>;
  reset: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (code?: string) => void;
          'expired-callback'?: () => void;
          'timeout-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact';
          action?: string;
          cData?: string;
          retry?: 'auto' | 'never';
          'retry-interval'?: number;
          tabindex?: number;
        }
      ) => string | undefined;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
    [key: `__turnstileOnLoad_${string}`]: (() => void) | undefined;
  }
}

// 生成唯一的全局回调名，避免多实例冲突
let instanceIdCounter = 0;

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ siteKey, onSuccess, onError, onStatus }, ref) {
    const [status, setStatus] = useState<TurnstileStatus>('idle');
    const [statusMsg, setStatusMsg] = useState('未验证');

    const widgetIdRef = useRef<string | null>(null);
    const tokenRef = useRef<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const destroyedRef = useRef(false);
    const instanceIdRef = useRef<string>(`turnstile_${++instanceIdCounter}_${Date.now()}`);
    const cbRef = useRef({ onSuccess, onError });
    cbRef.current = { onSuccess, onError };
    const statusCbRef = useRef(onStatus);
    statusCbRef.current = onStatus;

    // 状态变更回调
    useEffect(() => {
      statusCbRef.current?.(status);
    }, [status]);

    // siteKey 基础校验
    const isValidSiteKey = (key?: string): boolean => {
      return !!key && key.length > 20 && /^0x[0-9A-Za-z_-]+$/.test(key);
    };

    // Turnstile 常见错误码映射
    const getTurnstileErrorMsg = (code?: string): string => {
      switch (code) {
        case '300010':
          return '域名未授权：请在 Cloudflare Turnstile 控制台添加当前域名';
        case '600010':
          return '验证请求无效';
        case '700010':
          return 'Site Key 不存在或已失效';
        default:
          return code ? `验证失败 (${code})` : '验证失败';
      }
    };

    useEffect(() => {
      destroyedRef.current = false;

      if (!siteKey) {
        setStatus('failed');
        setStatusMsg('未配置 siteKey');
        return;
      }

      if (!isValidSiteKey(siteKey)) {
        console.error('[Turnstile] siteKey 格式不正确:', siteKey);
        setStatus('failed');
        setStatusMsg('siteKey 配置错误');
        return;
      }

      setStatus('loading');
      setStatusMsg('加载验证组件...');

      const instanceId = instanceIdRef.current;
      const callbackName = `__turnstileOnLoad_${instanceId}`;

      const loadSdk = (): Promise<void> => {
        if (window.turnstile) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>(
            'script[src*="challenges.cloudflare.com/turnstile"]'
          );
          if (existing) {
            // 脚本已在加载中，等待其完成
            const checkReady = () => {
              if (window.turnstile) {
                resolve();
              } else {
                setTimeout(checkReady, 100);
              }
            };
            checkReady();
            return;
          }

          // 注册唯一回调
          window[callbackName] = () => {
            resolve();
          };

          const script = document.createElement('script');
          script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?onload=${callbackName}`;
          script.async = true;
          script.defer = true;
          script.onerror = () => reject(new Error('SDK 脚本加载失败'));
          document.head.appendChild(script);

          // 10秒加载超时
          setTimeout(() => {
            if (!window.turnstile) {
              reject(new Error('SDK 加载超时'));
            }
          }, 10000);
        });
      };

      const initWidget = async () => {
        try {
          await loadSdk();

          if (destroyedRef.current) return;
          if (!window.turnstile) {
            throw new Error('Turnstile SDK 不可用');
          }
          if (!containerRef.current) {
            throw new Error('验证容器未挂载');
          }

          const widgetId = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: 'dark',
            size: 'normal',
            action: 'register',
            retry: 'auto',
            'retry-interval': 8000,
            callback: (token: string) => {
              if (destroyedRef.current) return;
              console.log('[Turnstile] 验证成功');
              tokenRef.current = token;
              setStatus('success');
              setStatusMsg('验证通过');
              cbRef.current.onSuccess?.(token);
            },
            'error-callback': (code?: string) => {
              if (destroyedRef.current) return;
              console.error('[Turnstile] 验证错误, code:', code);
              tokenRef.current = null;
              setStatus('failed');
              const msg = getTurnstileErrorMsg(code);
              setStatusMsg(msg);
              cbRef.current.onError?.(msg);
            },
            'expired-callback': () => {
              if (destroyedRef.current) return;
              console.log('[Turnstile] Token 已过期');
              tokenRef.current = null;
              setStatus('idle');
              setStatusMsg('验证已过期，请重新验证');
            },
            'timeout-callback': () => {
              if (destroyedRef.current) return;
              console.error('[Turnstile] 验证超时');
              tokenRef.current = null;
              setStatus('failed');
              setStatusMsg('验证超时');
              cbRef.current.onError?.('验证超时');
            },
          });

          if (!widgetId) {
            throw new Error('Turnstile render 返回空 widgetId');
          }

          widgetIdRef.current = widgetId;
          setStatus('idle');
          setStatusMsg('请完成验证');
        } catch (err) {
          if (destroyedRef.current) return;
          const msg = err instanceof Error ? err.message : '初始化失败';
          console.error('[Turnstile] 初始化失败:', msg);
          setStatus('failed');
          setStatusMsg(msg);
          cbRef.current.onError?.(msg);
        }
      };

      initWidget();

      return () => {
        destroyedRef.current = true;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (e) {
            // ignore
          }
        }
        widgetIdRef.current = null;
        tokenRef.current = null;
        // 清理全局回调
        if (window[callbackName]) {
          delete window[callbackName];
        }
      };
    }, [siteKey]);

    useImperativeHandle(ref, () => ({
      getToken: async () => {
        if (!siteKey) {
          console.warn('[Turnstile] 未配置 siteKey');
          return null;
        }
        if (tokenRef.current) {
          return tokenRef.current;
        }
        // 等待用户完成验证，最多等 60 秒
        return new Promise((resolve) => {
          let elapsed = 0;
          const interval = 300;
          const checkToken = () => {
            if (tokenRef.current) {
              resolve(tokenRef.current);
            } else if (status === 'failed') {
              resolve(null);
            } else if (elapsed >= 60000) {
              resolve(null);
            } else {
              elapsed += interval;
              setTimeout(checkToken, interval);
            }
          };
          checkToken();
        });
      },
      reset: () => {
        tokenRef.current = null;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (e) {
            console.warn('[Turnstile] reset 失败', e);
          }
        }
        setStatus('idle');
        setStatusMsg('请完成验证');
      },
    }));

    const iconColor =
      status === 'success'
        ? 'border-success/30 bg-success/10 text-success'
        : status === 'failed'
        ? 'border-danger/30 bg-danger/10 text-danger'
        : status === 'loading'
        ? 'border-warning/30 bg-warning/10 text-warning'
        : 'border-border-subtle bg-bg-surface text-text-muted';

    const Icon =
      status === 'success'
        ? ShieldCheck
        : status === 'loading'
        ? Loader2
        : ShieldAlert;

    return (
      <div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${iconColor}`}
        >
          <Icon
            size={12}
            className={status === 'loading' ? 'animate-spin' : ''}
          />
          {statusMsg}
        </div>
        <div ref={containerRef} className="mt-2 min-h-[65px]" />
      </div>
    );
  }
);

export default TurnstileWidget;
