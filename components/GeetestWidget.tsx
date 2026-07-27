'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { CaptchaTicket } from '@/lib/types';

interface GeetestWidgetProps {
  /** 验证成功回调，传入极验票据四元组 */
  onVerified: (ticket: CaptchaTicket) => void;
  /** 验证失败回调 */
  onError?: (msg: string) => void;
}

// 极验四代 captcha 对象（仅声明使用到的方法）
interface GeetestCaptcha {
  onSuccess: (cb: () => void) => void;
  onError: (cb: (e: { msg: string }) => void) => void;
  onClose: (cb: () => void) => void;
  appendTo: (selector: string) => void;
  getValidate: () => CaptchaTicket | null;
}

// 极验初始化参数
interface InitOptions {
  captchaId: string;
  /**
   * 极验四代渲染模式：
   * - bind：自触模式，需业务代码主动调用 captcha.verify() 才弹窗
   * - float：浮动模式，自动在 appendTo 容器内渲染滑块，用户拖动即可验证
   * - popup：弹窗模式
   * - custom：自定义模式
   * 本项目采用 float，避免业务侧手动触发 verify()，UX 更直接
   */
  product: 'bind' | 'float' | 'popup' | 'custom';
}

declare global {
  interface Window {
    initGeetest4?: (opts: InitOptions, cb: (captcha: GeetestCaptcha) => void) => void;
  }
}

const GEETEST_SDK_URL = 'https://static.geetest.com/v4/gt4.js';

/**
 * 极验 GeeTest4 无感验证前端组件
 *
 * - 动态加载极验 SDK（gt4.js）
 * - 初始化 captcha 对象（product: 'float' 浮动滑块模式）
 * - 用户拖动滑块完成验证后，通过 onVerified 回调传出票据四元组
 * - 未配置 captcha_id 时跳过验证（开发态），传空票据
 */
export default function GeetestWidget({ onVerified, onError }: GeetestWidgetProps) {
  const captchaId = process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID;
  const [verified, setVerified] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('未验证');

  // 防止重复初始化
  const initRef = useRef(false);
  // 缓存最新回调，避免 useEffect 依赖变化导致重复初始化
  const cbRef = useRef({ onVerified, onError });
  cbRef.current = { onVerified, onError };

  // 未配置 captcha_id：开发态跳过验证
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

  // 已配置：动态加载 SDK 并初始化
  useEffect(() => {
    if (!captchaId) return;
    if (initRef.current) return;
    initRef.current = true;

    // 动态加载 SDK 脚本
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
        // 初始化极验四代 - float 浮动滑块模式
        // SDK 会在 appendTo 容器内自动渲染拖动滑块，用户拖动完成即触发 onSuccess
        window.initGeetest4(
          { captchaId, product: 'float' },
          (captcha) => {
            captcha.onSuccess(() => {
              const result = captcha.getValidate();
              // 严格校验极验四代票据四元组全部非空字符串
              // 防止 SDK 异常情况下返回字段为空的对象导致后端校验失败
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
              } else {
                setVerified(false);
                setStatusMsg('验证失败');
                cbRef.current.onError?.('验证票据字段不完整，请重新拖动滑块');
              }
            });
            captcha.onError((e) => {
              setVerified(false);
              setStatusMsg('验证失败');
              cbRef.current.onError?.(e?.msg || '验证失败');
            });
            captcha.onClose(() => {
              setStatusMsg('未验证');
            });
            captcha.appendTo('#geetest-captcha');
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
      {/* 极验滑块渲染容器 - 必须可见，float 模式下 SDK 会在此渲染拖动滑块 */}
      <div id="geetest-captcha" className="geetest-captcha-box min-h-[44px]" />

      {/* 验证状态指示（辅助提示，极验本身也会显示状态）*/}
      <div
        className={`mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
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
