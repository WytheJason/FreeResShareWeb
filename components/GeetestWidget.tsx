'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { CaptchaTicket } from '@/lib/types';

interface GeetestWidgetProps {
  onVerified: (ticket: CaptchaTicket) => void;
  onError?: (msg: string) => void;
}

export interface GeetestWidgetHandle {
  verify: () => Promise<CaptchaTicket | null>;
  reset: () => void;
}

interface GeetestCaptcha {
  onSuccess: (cb: () => void) => void;
  onError: (cb: (e: { msg: string }) => void) => void;
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
}

declare global {
  interface Window {
    initGeetest4?: (opts: InitOptions, cb: (captcha: GeetestCaptcha) => void) => void;
    loadGeetest4?: (opts: InitOptions, cb: (captcha: GeetestCaptcha) => void) => void;
  }
}

const GEETEST_SDK_URL = 'https://static.geetest.com/v4/gt4.js';

const GeetestWidget = forwardRef<GeetestWidgetHandle, GeetestWidgetProps>(
  function GeetestWidget({ onVerified, onError }, ref) {
    const captchaId = process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID;
    const [verified, setVerified] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string>('未验证');

    const initRef = useRef(false);
    const captchaRef = useRef<GeetestCaptcha | null>(null);
    const cbRef = useRef({ onVerified, onError });
    cbRef.current = { onVerified, onError };

    const pendingVerifyRef = useRef<{
      resolve: (ticket: CaptchaTicket | null) => void;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      verify: async () => {
        if (!captchaId) {
          return { lot_number: '', captcha_output: '', pass_token: '', gen_time: '' };
        }
        if (!captchaRef.current) {
          cbRef.current.onError?.('极验未初始化，请稍后重试');
          return null;
        }

        return new Promise<CaptchaTicket | null>((resolve) => {
          pendingVerifyRef.current = { resolve };

          const captcha = captchaRef.current;

          const handleSuccess = () => {
            const result = captcha.getValidate();
            if (
              result &&
              result.lot_number &&
              result.captcha_output &&
              result.pass_token &&
              result.gen_time
            ) {
              setVerified(true);
              setStatusMsg('已验证');
              cbRef.current.onVerified(result);
              resolve(result);
            } else {
              setVerified(false);
              setStatusMsg('验证失败');
              resolve(null);
            }
            pendingVerifyRef.current = null;
          };

          const handleError = (e: { msg: string }) => {
            setVerified(false);
            setStatusMsg('验证失败');
            cbRef.current.onError?.(e?.msg || '验证失败');
            resolve(null);
            pendingVerifyRef.current = null;
          };

          const handleClose = () => {
            setStatusMsg('未验证');
            resolve(null);
            pendingVerifyRef.current = null;
          };

          captcha.onSuccess(handleSuccess);
          captcha.onError(handleError);
          captcha.onClose(handleClose);

          try {
            captcha.verify();
          } catch (err) {
            console.error('[Geetest] verify() 调用异常', err);
            cbRef.current.onError?.('极验验证启动失败');
            resolve(null);
            pendingVerifyRef.current = null;
          }
        });
      },
      reset: () => {
        setVerified(false);
        setStatusMsg('未验证');
        captchaRef.current?.reset?.();
      },
    }));

    useEffect(() => {
      if (captchaId) return;
      if (initRef.current) return;
      initRef.current = true;
      setStatusMsg('未配置极验，跳过验证');
      cbRef.current.onVerified({
        lot_number: '',
        captcha_output: '',
        pass_token: '',
        gen_time: '',
      });
    }, [captchaId]);

    useEffect(() => {
      if (!captchaId) return;
      if (initRef.current) return;
      initRef.current = true;

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
            setStatusMsg('极验加载失败');
            cbRef.current.onError?.('极验 SDK 加载失败');
            return;
          }
          window.initGeetest4(
            { captchaId, product: 'bind' },
            (captcha) => {
              captchaRef.current = captcha;
              captcha.appendTo('body');

              captcha.onReady?.(() => {
                setStatusMsg('验证就绪');
              });

              setStatusMsg('验证就绪');
              console.log('[Geetest] 极验四代无感验证初始化成功');
            }
          );
        })
        .catch((err: unknown) => {
          setStatusMsg('极验加载失败');
          const msg = err instanceof Error ? err.message : 'SDK 加载失败';
          cbRef.current.onError?.(msg);
        });
    }, [captchaId]);

    return (
      <div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
            verified
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border-subtle bg-bg-surface text-text-muted'
          }`}
        >
          {verified ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          {statusMsg}
        </div>
      </div>
    );
  }
);

export default GeetestWidget;
