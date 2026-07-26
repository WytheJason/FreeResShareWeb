/**
 * 无权限提示页
 * 支持通过 query.reason 区分场景：no-permission / banned
 */

import Link from 'next/link';
import { ShieldX, Home, LogIn } from 'lucide-react';

export default function UnauthorizedPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const isBanned = searchParams.reason === 'banned';
  const title = isBanned ? '账号已被封禁' : '无访问权限';
  const desc = isBanned
    ? '您的账号因违规操作已被管理员封禁，如有疑问请联系管理员。'
    : '当前页面需要相应权限才能访问，请登录或升级会员后再试。';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center fade-in">
      <div className="grid h-24 w-24 place-items-center rounded-full bg-danger/10">
        <ShieldX className="text-danger" size={48} />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <p className="max-w-md text-text-muted">{desc}</p>
      </div>

      <div className="flex gap-3">
        <Link href="/" className="btn-secondary">
          <Home size={16} />
          返回首页
        </Link>
        {!isBanned && (
          <Link href="/login" className="btn-primary">
            <LogIn size={16} />
            去登录
          </Link>
        )}
      </div>
    </div>
  );
}
