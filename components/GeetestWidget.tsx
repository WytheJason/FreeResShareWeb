'use client';

import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { CaptchaTicket } from '@/lib/types';

type CaptchaStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'verified';

interface GeetestWidgetProps {
  onVerified: (ticket: CaptchaTicket) => void;
  onError?: (msg: string) => void;
  onStatus?: (status: CaptchaStatus, msg: string) => void;
}

export interface GeetestWidgetHandle {
  verify: () => Promise<CaptchaTicket | null>;
  reset: () => void;
}

export type { CaptchaStatus };

interface GeetestCaptcha {
  onSuccess: (cb: () => void) => void;
  onError: (cb: (e: { msg: string; code?: number }) => void) => void;
  onClose: (cb: () => void) => void;
  onReady?: (cb: () => void) => void;
  appendTo: (selector: string) => void;
  getValidate: () => CaptchaTicket | null;
  verify: () => void;
  destroy: () => void;
  reset: () => void;
}

interface InitOptions {
  captchaId: string;
  product: 'bind' | 'float' | 'popup' | 'custom';
  nativeButton?: string;
  onReady?: () => void;
  onError?: (e: { msg: string; code?: number }) => void;
}

declare global {
  interface Window {
    initGeetest4?: (opts: InitOptions, cb: (captcha: GeetestCaptcha) => void) => void;
  }
}

const GEETEST_SDK_URL = 'https://static.geetest.com/v4/gt4.js';

const EMPTY_TICKET: CaptchaTicket = {
  lot_number: '',
  captcha_output: '',
  pass_token: '',
  gen_time: '',
};

const GeetestWidget = forwardRef<GeetestWidgetHandle, GeetestWidgetProps>(
  function GeetestWidget({ onVerified, onError, onStatus }, ref) {
    const captchaId = process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID;
    const [status, setStatus] = useState<CaptchaStatus>('idle');
    const [statusMsg, setStatusMsg] = useState<string>('未验证');

    const initStartedRef = useRef(false);
    const captchaRef = useRef<GeetestCaptcha | null>(null);
    const cbRef = useRef({ onVerified, onError });
    cbRef.current = { onVerified, onError };
    const statusCbRef = useRef(onStatus);
    statusCbRef.current = onStatus;

    const initPromiseRef = useRef<Promise<void> | null>(null);
    const initResolveRef = useRef<(() => void) | null>(null);
    const initRejectRef = useRef<((err: unknown) => void) | null>(null);

    const pendingVerifyRef = useRef<{
      resolve: (ticket: CaptchaTicket | null) => void;
    } | null>(null);

    if (!initPromiseRef.current) {
      initPromiseRef.current = new Promise<void>((resolve, reject) => {
        initResolveRef.current = resolve;
        initRejectRef.current = reject;
      });
    }

    const markFailed = (msg: string) => {
      setStatus('failed');
      setStatusMsg(msg);
      cbRef.current.onError?.(msg);
    };

    const waitInit = (): Promise<void> => {
      if (!captchaId) return Promise.resolve();
      return initPromiseRef.current ?? Promise.reject(new Error('初始化未开始'));
    };

    useImperativeHandle(ref, () => ({
      verify: async () => {
        if (!captchaId) {
          cbRef.current.onVerified(EMPTY_TICKET);
          return EMPTY_TICKET;
        }

        try {
          await waitInit();
        } catch (err) {
          const msg = err instanceof Error ? err.message : '极验初始化失败';
          cbRef.current.onError?.(msg);
          return null;
        }

        if (!captchaRef.current) {
          cbRef.current.onError?.('极验未初始化，请稍后重试');
          return null;
        }

        return new Promise<CaptchaTicket | null>((resolve) => {
          pendingVerifyRef.current = { resolve };

          const captcha = captchaRef.current;
          if (!captcha) {
            cbRef.current.onError?.('极验未初始化，请稍后重试');
            resolve(null);
            pendingVerifyRef.current = null;
            return;
          }

          let settled = false;
          const finish = (result: CaptchaTicket | null) => {
            if (settled) return;
            settled = true;
            resolve(result);
            pendingVerifyRef.current = null;
          };

          const timeoutMs = 15000;
          const timer = setTimeout(() => {
            if (settled) return;
            setStatus('idle');
            setStatusMsg('验证超时');
            cbRef.current.onError?.('验证超时，请重试');
            finish(null);
          }, timeoutMs);

          const handleSuccess = () => {
            if (settled) return;
            clearTimeout(timer);
            const result = captcha.getValidate();
            if (
              result &&
              result.lot_number &&
              result.captcha_output &&
              result.pass_token &&
              result.gen_time
            ) {
              setStatus('verified');
              setStatusMsg('已验证');
              cbRef.current.onVerified(result);
              finish(result);
            } else {
              setStatus('idle');
              setStatusMsg('验证失败');
              cbRef.current.onError?.('票据获取失败，请重试');
              finish(null);
            }
          };

          const handleError = (e: { msg: string; code?: number }) => {
            if (settled) return;
            clearTimeout(timer);
            setStatus('idle');
            setStatusMsg('验证失败');
            const msg = e?.msg || '验证失败，请重试';
            cbRef.current.onError?.(msg);
            finish(null);
          };

          const handleClose = () => {
            if (settled) return;
            clearTimeout(timer);
            setStatus('idle');
            setStatusMsg('验证已取消');
            cbRef.current.onError?.('验证已取消，请重试');
            finish(null);
          };

          captcha.onSuccess(handleSuccess);
          captcha.onError(handleError);
          captcha.onClose(handleClose);

          try {
            captcha.verify();
          } catch (err) {
            clearTimeout(timer);
            console.error('[Geetest] verify() 调用异常', err);
            cbRef.current.onError?.('极验验证启动失败');
            finish(null);
          }
        });
      },
      reset: () => {
        setStatus('idle');
        setStatusMsg('未验证');
        captchaRef.current?.reset?.();
      },
    }));

    useEffect(() => {
      statusCbRef.current?.(status, statusMsg);
    }, [status, statusMsg]);

    useEffect(() => {
      if (captchaId) return;
      if (initStartedRef.current) return;
      initStartedRef.current = true;
      setStatus('verified');
      setStatusMsg('未配置极验，跳过验证');
      cbRef.current.onVerified(EMPTY_TICKET);
    }, [captchaId]);

    useEffect(() => {
      if (!captchaId) return;
      if (initStartedRef.current) return;
      initStartedRef.current = true;
      setStatus('loading');
      setStatusMsg('正在加载极验...');

      const loadSdk = (): Promise<void> => {
        if (window.initGeetest4) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>(
            `script[src="${GEETEST_SDK_URL}"]`
          );
          if (existing) {
            if (window.initGeetest4) {
              resolve();
              return;
            }
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('SDK 加载失败')));
            return;
          }
          const script = document.createElement('script');
          script.src = GEETEST_SDK_URL;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('SDK 加载失败'));
          document.head.appendChild(script);
        });
      };

      loadSdk()
        .then(() => {
          if (!window.initGeetest4) {
            throw new Error('极验 SDK 加载异常');
          }
          const initFn = window.initGeetest4;

          return new Promise<void>((resolve, reject) => {
            try {
              initFn(
                {
                  captchaId,
                  product: 'float',
                  onReady: () => {
                    setStatus('ready');
                    setStatusMsg('请完成滑动验证');
                    resolve();
                  },
                  onError: (e) => {
                    console.error('[Geetest] 初始化 onError', e);
                    reject(new Error(e?.msg || '极验初始化失败'));
                  },
                },
                (captcha) => {
                  captchaRef.current = captcha;
                  captcha.appendTo('.geetest-captcha-box');

                  captcha.onReady?.(() => {
                    setStatus('ready');
                    setStatusMsg('请完成滑动验证');
                  });
                }
              );
            } catch (err) {
              reject(err);
            }
          });
        })
        .then(() => {
          initResolveRef.current?.();
          console.log('[Geetest] 极验四代无感验证初始化成功');
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : '极验加载失败';
          initRejectRef.current?.(err);
          markFailed(msg);
        });

      return () => {
        captchaRef.current?.destroy?.();
        captchaRef.current = null;
      };
    }, [captchaId]);

    const iconColor =
      status === 'verified'
        ? 'border-success/30 bg-success/10 text-success'
        : status === 'failed'
        ? 'border-danger/30 bg-danger/10 text-danger'
        : 'border-border-subtle bg-bg-surface text-text-muted';

    return (
      <div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${iconColor}`}
        >
          {status === 'verified' ? (
            <ShieldCheck size={12} />
          ) : status === 'failed' ? (
            <ShieldAlert size={12} />
          ) : (
            <ShieldAlert size={12} />
          )}
          {statusMsg}
        </div>
        <div className="geetest-captcha-box mt-2 min-h-[44px]" />
      </div>
    );
  }
);

export default GeetestWidget;
