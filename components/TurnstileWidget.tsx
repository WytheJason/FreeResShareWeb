'use client';

import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

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
          'error-callback'?: (error: string) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact';
          action?: string;
          cData?: string;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const TURNSTILE_SDK_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ siteKey, onSuccess, onError, onStatus }, ref) {
    const [status, setStatus] = useState<TurnstileStatus>('idle');
    const [statusMsg, setStatusMsg] = useState('未验证');

    const widgetIdRef = useRef<string | null>(null);
    const tokenRef = useRef<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const initStartedRef = useRef(false);
    const cbRef = useRef({ onSuccess, onError });
    cbRef.current = { onSuccess, onError };
    const statusCbRef = useRef(onStatus);
    statusCbRef.current = onStatus;

    useEffect(() => {
      statusCbRef.current?.(status);
    }, [status]);

    useEffect(() => {
      if (!siteKey) {
        setStatus('idle');
        setStatusMsg('未配置 siteKey');
        return;
      }
      if (initStartedRef.current) return;
      initStartedRef.current = true;

      setStatus('loading');
      setStatusMsg('加载验证组件...');

      const loadSdk = (): Promise<void> => {
        if (window.turnstile) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>(
            `script[src^="https://challenges.cloudflare.com/turnstile"]`
          );
          if (existing) {
            if (window.turnstile) {
              resolve();
              return;
            }
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('SDK 加载失败')));
            return;
          }

          window.onTurnstileLoad = () => {
            resolve();
          };

          const script = document.createElement('script');
          script.src = TURNSTILE_SDK_URL;
          script.async = true;
          script.defer = true;
          script.onerror = () => reject(new Error('SDK 加载失败'));
          document.head.appendChild(script);
        });
      };

      loadSdk()
        .then(() => {
          if (!window.turnstile || !containerRef.current) {
            throw new Error('Turnstile 加载失败');
          }

          const widgetId = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: 'dark',
            size: 'normal',
            action: 'register',
            callback: (token: string) => {
              console.log('[Turnstile] 验证成功');
              tokenRef.current = token;
              setStatus('success');
              setStatusMsg('验证通过');
              cbRef.current.onSuccess?.(token);
            },
            'error-callback': (error: string) => {
              console.error('[Turnstile] 验证失败', error);
              setStatus('failed');
              setStatusMsg('验证失败');
              cbRef.current.onError?.(error);
            },
            'expired-callback': () => {
              console.log('[Turnstile] Token 已过期');
              tokenRef.current = null;
              setStatus('idle');
              setStatusMsg('验证已过期');
            },
          });

          widgetIdRef.current = widgetId;
          setStatus('idle');
          setStatusMsg('请完成验证');
        })
        .catch((err) => {
          console.error('[Turnstile] 初始化失败', err);
          setStatus('failed');
          setStatusMsg('初始化失败');
          cbRef.current.onError?.(err instanceof Error ? err.message : '初始化失败');
        });

      return () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
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
        // 等待用户完成验证
        return new Promise((resolve) => {
          const checkToken = () => {
            if (tokenRef.current) {
              resolve(tokenRef.current);
            } else if (status === 'failed') {
              resolve(null);
            } else {
              setTimeout(checkToken, 500);
            }
          };
          checkToken();
        });
      },
      reset: () => {
        tokenRef.current = null;
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
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
        : 'border-border-subtle bg-bg-surface text-text-muted';

    return (
      <div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${iconColor}`}
        >
          {status === 'success' ? (
            <ShieldCheck size={12} />
          ) : status === 'failed' ? (
            <ShieldAlert size={12} />
          ) : (
            <ShieldAlert size={12} />
          )}
          {statusMsg}
        </div>
        <div ref={containerRef} className="mt-2" />
      </div>
    );
  }
);

export default TurnstileWidget;