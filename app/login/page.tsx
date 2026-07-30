'use client';

/**
 * 登录 / 注册页（客户端组件）
 * - Tab 切换：登录 / 注册（默认登录）
 * - 登录表单：email + password + 显示/隐藏密码
 * - 注册表单：email + password + confirm_password + nickname(可选) + Turnstile 验证
 * - 已登录用户访问自动跳转首页
 * - 登录成功后跳转到 redirect 参数或 '/'
 * - 注册成功后自动切换到登录 tab
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Eye, EyeOff, Sparkles, ArrowLeft } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase';
import {
  isValidEmail,
  isValidPassword,
  isValidNickname,
} from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { Spinner } from '@/components/Loading';
import TurnstileWidget, {
  type TurnstileWidgetHandle,
} from '@/components/TurnstileWidget';

type TabKey = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<TabKey>('login');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [redirect, setRedirect] = useState('/');
  const [checkedAuth, setCheckedAuth] = useState(false);

  // 登录表单状态
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');

  // 注册表单状态
  const [regEmail, setRegEmail] = useState('');
  const [regPwd, setRegPwd] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regNick, setRegNick] = useState('');
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // 读取 redirect 参数 + 检查登录态
  useEffect(() => {
    // 从 URL 读取 redirect 参数（避免使用 useSearchParams 触发 Suspense 要求）
    try {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('redirect');
      if (r && r.startsWith('/')) {
        setRedirect(r);
      }
    } catch {
      // ignore
    }

    // 检查是否已登录：已登录则跳转首页
    const supabase = getSupabaseBrowser();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session?.user) {
          router.replace('/');
        } else {
          setCheckedAuth(true);
        }
      })
      .catch(() => setCheckedAuth(true));
  }, [router]);

  // ============ 登录提交 ============
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(loginEmail)) {
      toast.show('error', '邮箱格式不正确');
      return;
    }
    if (!loginPwd) {
      toast.show('error', '请输入密码');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPwd }),
      });
      const data = await res.json();
      if (data.code === 0) {
        toast.show('success', '登录成功');
        // 短暂延迟确保 toast 显示
        router.push(redirect);
        router.refresh();
      } else {
        toast.show('error', data.message || '登录失败');
      }
    } catch {
      toast.show('error', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  // ============ 注册提交 ============
  async function handleRegister(e: FormEvent) {
    e.preventDefault();

    if (!isValidEmail(regEmail)) {
      toast.show('error', '邮箱格式不正确');
      return;
    }
    const pwdCheck = isValidPassword(regPwd);
    if (!pwdCheck.valid) {
      toast.show('error', pwdCheck.message ?? '密码不合法');
      return;
    }
    if (regPwd !== regConfirm) {
      toast.show('error', '两次输入的密码不一致');
      return;
    }
    if (regNick && !isValidNickname(regNick)) {
      toast.show('error', '昵称格式不正确（1-20 位中英文数字下划线）');
      return;
    }

    setLoading(true);
    try {
      const token = await turnstileRef.current?.getToken();
      if (!token) {
        toast.show('error', '请先完成人机验证');
        return;
      }

      console.log('[Register] 提交注册');
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPwd,
          nickname: regNick.trim() || undefined,
          captcha: { type: 'turnstile', token },
        }),
      });
      const data = await res.json();
      console.log('[Register] API 返回:', data.code, data.message);

      if (data.code === 0) {
        toast.show('success', '注册成功，请登录');
        setLoginEmail(regEmail);
        setRegEmail('');
        setRegPwd('');
        setRegConfirm('');
        setRegNick('');
        turnstileRef.current?.reset();
        setTab('login');
      } else {
        toast.show('error', data.message || '注册失败');
        turnstileRef.current?.reset();
      }
    } catch (err) {
      console.error('[Register] 异常', err);
      toast.show('error', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  // 等待登录态检查完成（避免已登录用户看到表单闪烁）
  if (!checkedAuth) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-md md:mt-12">
      {/* 返回首页 */}
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-primary-300"
      >
        <ArrowLeft size={12} />
        返回首页
      </Link>

      <div className="card overflow-hidden p-6 fade-in">
        {/* Logo / 标题 */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-600/30">
            <Sparkles className="text-white" size={22} />
          </div>
          <h1 className="text-xl font-bold text-text-primary">软件/影视网盘资源分享论坛</h1>
          <p className="mt-1 text-xs text-text-muted">登录后即可发布资源与评论</p>
        </div>

        {/* Tab 切换 */}
        <div className="mb-6 flex rounded-lg bg-bg-base p-1">
          {(
            [
              { key: 'login', label: '登录' },
              { key: 'register', label: '注册' },
            ] as { key: TabKey; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 登录表单 */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 slide-up">
            {/* 邮箱 */}
            <div>
              <label className="mb-1 block text-xs text-text-muted">邮箱</label>
              <div className="relative">
                <Mail
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
                />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field pl-9"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="mb-1 block text-xs text-text-muted">密码</label>
              <div className="relative">
                <Lock
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
                />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={loginPwd}
                  onChange={(e) => setLoginPwd(e.target.value)}
                  placeholder="请输入密码"
                  className="input-field px-9"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim transition-colors hover:text-text-primary"
                  aria-label={showPwd ? '隐藏密码' : '显示密码'}
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <>
                  <Spinner />
                  处理中...
                </>
              ) : (
                '登录'
              )}
            </button>
          </form>
        )}

        {/* 注册表单 */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4 slide-up">
            {/* 邮箱 */}
            <div>
              <label className="mb-1 block text-xs text-text-muted">邮箱</label>
              <div className="relative">
                <Mail
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
                />
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field pl-9"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="mb-1 block text-xs text-text-muted">
                密码（8-32 位，含字母与数字）
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
                />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={regPwd}
                  onChange={(e) => setRegPwd(e.target.value)}
                  placeholder="设置登录密码"
                  className="input-field px-9"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim transition-colors hover:text-text-primary"
                  aria-label={showPwd ? '隐藏密码' : '显示密码'}
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* 确认密码 */}
            <div>
              <label className="mb-1 block text-xs text-text-muted">
                确认密码
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
                />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="再次输入密码"
                  className="input-field pl-9"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            {/* 昵称（可选） */}
            <div>
              <label className="mb-1 block text-xs text-text-muted">
                昵称（可选，1-20 位）
              </label>
              <div className="relative">
                <User
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
                />
                <input
                  type="text"
                  value={regNick}
                  onChange={(e) => setRegNick(e.target.value)}
                  placeholder="给自己起个名字"
                  className="input-field pl-9"
                  maxLength={20}
                />
              </div>
            </div>

            {/* 人机验证 */}
            <div>
              <label className="mb-1 block text-xs text-text-muted">
                人机验证
              </label>
              <TurnstileWidget
                ref={turnstileRef}
                siteKey={turnstileSiteKey}
                onSuccess={(token) => {
                  console.log('[Turnstile] 验证成功');
                }}
                onError={(error) => {
                  toast.show('error', `验证失败: ${error}`);
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Spinner />
                  处理中...
                </>
              ) : (
                '注册'
              )}
            </button>
          </form>
        )}

        {/* 协议提示 */}
        <p className="mt-4 text-center text-xs text-text-dim">
          注册即表示同意
          <Link href="/agreement" className="link mx-1">
            用户协议
          </Link>
          与
          <Link href="/privacy" className="link mx-1">
            隐私政策
          </Link>
        </p>
      </div>
    </div>
  );
}
