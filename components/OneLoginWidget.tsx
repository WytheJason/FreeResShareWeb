'use client';

import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';
import { Smartphone, CheckCircle, XCircle } from 'lucide-react';

export interface OneLoginTicket {
  token: string;
  phone: string;
  process_id?: string;
  accesscode?: string;
}

type OneLoginStatus = 'idle' | 'loading' | 'ready' | 'verifying' | 'success' | 'failed';

interface OneLoginWidgetProps {
  appId?: string;
  onSuccess?: (ticket: OneLoginTicket) => void;
  onFail?: (error: { code: string; msg: string }) => void;
  onStatus?: (status: OneLoginStatus) => void;
}

export interface OneLoginWidgetHandle {
  verify: () => Promise<OneLoginTicket | null>;
  destroy: () => void;
}

declare global {
  interface Window {
    GOL?: {
      new (options: {
        app_id: string;
        timeout?: number;
        logo?: string;
        app?: string;
        product?: 'float' | 'popup';
      }): GOLInstance;
    };
    gtoneloginh5?: string;
  }
}

interface GOLInstance {
  gateway: () => void;
  onTokenSuccess: (cb: (data: OneLoginTicket) => void) => void;
  onTokenFail: (cb: (e: { code: string; msg?: string }) => void) => void;
  destory: () => void;
}

const ONELOGIN_SDK_URL = 'https://static.geetest.com/v1/onelogin/gtoneloginh5.js';

const OneLoginWidget = forwardRef<OneLoginWidgetHandle, OneLoginWidgetProps>(
  function OneLoginWidget({ appId, onSuccess, onFail, onStatus }, ref) {
    const [status, setStatus] = useState<OneLoginStatus>('idle');
    const [statusMsg, setStatusMsg] = useState('未验证');
    const [maskedPhone, setMaskedPhone] = useState('');

    const instanceRef = useRef<GOLInstance | null>(null);
    const initStartedRef = useRef(false);
    const cbRef = useRef({ onSuccess, onFail });
    cbRef.current = { onSuccess, onFail };
    const statusCbRef = useRef(onStatus);
    statusCbRef.current = onStatus;

    const pendingVerifyRef = useRef<{
      resolve: (ticket: OneLoginTicket | null) => void;
      reject: (error: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    } | null>(null);

    useEffect(() => {
      statusCbRef.current?.(status);
    }, [status]);

    useEffect(() => {
      if (!appId) {
        setStatus('idle');
        setStatusMsg('未配置 app_id');
        return;
      }
      if (initStartedRef.current) return;
      initStartedRef.current = true;

      setStatus('loading');
      setStatusMsg('加载一键验证...');

      const loadSdk = (): Promise<void> => {
        if (window.GOL) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>(
            `script[src="${ONELOGIN_SDK_URL}"]`
          );
          if (existing) {
            if (window.GOL) {
              resolve();
              return;
            }
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('SDK 加载失败')));
            return;
          }
          const script = document.createElement('script');
          script.src = ONELOGIN_SDK_URL;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('SDK 加载失败'));
          document.head.appendChild(script);
        });
      };

      loadSdk()
        .then(() => {
          if (!window.GOL) {
            throw new Error('一键验证 SDK 加载异常');
          }

          instanceRef.current = new window.GOL({
            app_id: appId,
            timeout: 15000,
            app: 'FreeRes',
            product: 'float',
          });

          instanceRef.current.onTokenSuccess((data) => {
            console.log('[OneLogin] 获取 token 成功', data);
            setStatus('success');
            setStatusMsg('验证成功');
            if (data.phone) {
              setMaskedPhone(data.phone);
            }
            cbRef.current.onSuccess?.(data);
            if (pendingVerifyRef.current) {
              clearTimeout(pendingVerifyRef.current.timer);
              pendingVerifyRef.current.resolve(data);
              pendingVerifyRef.current = null;
            }
          });

          instanceRef.current.onTokenFail((e) => {
            console.error('[OneLogin] 获取 token 失败', e);
            setStatus('failed');
            setStatusMsg('验证失败');
            cbRef.current.onFail?.({ code: e.code, msg: e.msg || '验证失败' });
            if (pendingVerifyRef.current) {
              clearTimeout(pendingVerifyRef.current.timer);
              pendingVerifyRef.current.resolve(null);
              pendingVerifyRef.current = null;
            }
          });

          setStatus('ready');
          setStatusMsg('点击按钮开始验证');
        })
        .catch((err) => {
          console.error('[OneLogin] 初始化失败', err);
          setStatus('failed');
          setStatusMsg('初始化失败');
        });

      return () => {
        instanceRef.current?.destory?.();
        instanceRef.current = null;
      };
    }, [appId]);

    useImperativeHandle(ref, () => ({
      verify: async () => {
        if (!appId) {
          console.warn('[OneLogin] 未配置 app_id');
          return null;
        }

        if (status === 'success' && maskedPhone) {
          return { token: '', phone: maskedPhone };
        }

        if (!instanceRef.current) {
          console.error('[OneLogin] 实例未初始化');
          return null;
        }

        return new Promise<OneLoginTicket | null>((resolve) => {
          const timer = setTimeout(() => {
            setStatus('failed');
            setStatusMsg('验证超时');
            cbRef.current.onFail?.({ code: 'TIMEOUT', msg: '验证超时' });
            pendingVerifyRef.current = null;
            resolve(null);
          }, 20000);

          pendingVerifyRef.current = { resolve, reject: () => resolve(null), timer };
          setStatus('verifying');
          setStatusMsg('正在验证...');
          instanceRef.current!.gateway();
        });
      },
      destroy: () => {
        instanceRef.current?.destory?.();
        instanceRef.current = null;
        setStatus('idle');
        setStatusMsg('未验证');
        setMaskedPhone('');
      },
    }));

    const iconColor =
      status === 'success'
        ? 'border-success/30 bg-success/10 text-success'
        : status === 'failed'
        ? 'border-danger/30 bg-danger/10 text-danger'
        : status === 'loading' || status === 'verifying'
        ? 'border-primary-400/30 bg-primary-400/10 text-primary-400'
        : 'border-border-subtle bg-bg-surface text-text-muted';

    return (
      <div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${iconColor}`}
        >
          {status === 'success' ? (
            <CheckCircle size={12} />
          ) : status === 'failed' ? (
            <XCircle size={12} />
          ) : (
            <Smartphone size={12} />
          )}
          {statusMsg}
          {maskedPhone && (
            <span className="ml-1 text-success">({maskedPhone.slice(-4)})</span>
          )}
        </div>
      </div>
    );
  }
);

export default OneLoginWidget;