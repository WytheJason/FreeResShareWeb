'use client';

/**
 * 用户表格客户端组件
 * - 接收服务端传入的初始数据
 * - 搜索 / 分页通过 URL searchParams 驱动（router.push）
 * - VIP 操作对话框 + 封禁/解封
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, ShieldCheck, Search, Ban, X } from 'lucide-react';
import type { UserProfile, VipAction } from '@/lib/types';
import { VIP_ACTION_LABELS } from '@/lib/types';
import { formatDateTime, calcTotalPages } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import Pagination from '@/components/Pagination';
import Empty from '@/components/Empty';

interface UsersTableProps {
  initialUsers: UserProfile[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

// 天数预设（永久 = 3650 天，约 10 年）
const DAYS_PRESETS: { label: string; value: number }[] = [
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
  { label: '365 天', value: 365 },
  { label: '永久', value: 3650 },
];

export default function UsersTable({
  initialUsers,
  total,
  page,
  pageSize,
  query,
}: UsersTableProps) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  // 搜索框输入
  const [searchInput, setSearchInput] = useState(query);

  // VIP 操作对话框状态
  const [vipOpen, setVipOpen] = useState(false);
  const [vipUser, setVipUser] = useState<UserProfile | null>(null);
  const [vipAction, setVipAction] = useState<VipAction>('open');
  const [vipDays, setVipDays] = useState(30);
  const [vipNote, setVipNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalPages = calcTotalPages(total, pageSize);

  // 提交搜索：更新 URL
  const handleSearch = () => {
    startTransition(() => {
      const params = new URLSearchParams();
      const q = searchInput.trim();
      if (q) params.set('q', q);
      params.set('page', '1');
      router.push(`/admin/users?${params.toString()}`);
    });
  };

  // 翻页：更新 URL
  const handlePageChange = (next: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('page', String(next));
    router.push(`/admin/users?${params.toString()}`);
  };

  // 打开 VIP 操作对话框
  const openVipDialog = (user: UserProfile) => {
    setVipUser(user);
    setVipAction(user.is_vip ? 'renew' : 'open');
    setVipDays(30);
    setVipNote('');
    setVipOpen(true);
  };

  // 提交 VIP 操作
  const handleVipSubmit = async () => {
    if (!vipUser) return;
    if (vipAction !== 'cancel' && (!vipDays || vipDays <= 0)) {
      toast.show('error', '请填写正确的天数');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch('/api/user/vip-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: vipUser.id,
          action: vipAction,
          days: vipAction === 'cancel' ? 0 : vipDays,
          note: vipNote || undefined,
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', 'VIP 操作成功');
        setVipOpen(false);
        router.refresh();
      } else {
        toast.show('error', json.message ?? '操作失败');
      }
    } catch {
      toast.show('error', '网络异常');
    } finally {
      setSubmitting(false);
    }
  };

  // 封禁/解封
  const handleBan = async (user: UserProfile) => {
    const next = !user.is_banned;
    if (!confirm(`确定要${next ? '封禁' : '解封'}该用户吗？`)) return;
    try {
      const res = await fetch('/api/user/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, banned: next }),
      });
      const json = await res.json();
      if (json.code === 0) {
        toast.show('success', next ? '已封禁' : '已解封');
        router.refresh();
      } else {
        toast.show('error', json.message ?? '操作失败');
      }
    } catch {
      toast.show('error', '网络异常');
    }
  };

  return (
    <div className="space-y-4 fade-in">
      {/* 页头 + 搜索 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="section-title">用户管理</h1>
        <div className="flex items-center gap-2">
          <input
            className="input-field w-56"
            placeholder="搜索邮箱 / 昵称"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn-primary" onClick={handleSearch}>
            <Search size={14} />
            搜索
          </button>
        </div>
      </div>

      {/* 用户表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-text-muted">
                <th className="px-3 py-3 text-left font-medium">头像</th>
                <th className="px-3 py-3 text-left font-medium">昵称</th>
                <th className="px-3 py-3 text-left font-medium">邮箱</th>
                <th className="px-3 py-3 text-left font-medium">角色</th>
                <th className="px-3 py-3 text-left font-medium">状态</th>
                <th className="px-3 py-3 text-left font-medium">发帖</th>
                <th className="px-3 py-3 text-left font-medium">评论</th>
                <th className="px-3 py-3 text-left font-medium">注册时间</th>
                <th className="px-3 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {initialUsers.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <Empty text="暂无用户" />
                  </td>
                </tr>
              ) : (
                initialUsers.map((u) => {
                  const roleTag = u.is_admin ? (
                    <span className="tag bg-danger/15 text-danger">admin</span>
                  ) : u.is_vip ? (
                    <span className="tag tag-vip">vip</span>
                  ) : (
                    <span className="tag bg-bg-hover text-text-muted">user</span>
                  );
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border-subtle transition-colors hover:bg-bg-hover"
                    >
                      <td className="px-3 py-3">
                        {u.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.avatar}
                            alt={u.nickname}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-500/20 text-xs text-primary-300">
                            {(u.nickname || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-text-primary">{u.nickname || '匿名'}</td>
                      <td className="px-3 py-3 text-text-muted">{u.email}</td>
                      <td className="px-3 py-3">{roleTag}</td>
                      <td className="px-3 py-3">
                        {u.is_banned ? (
                          <span className="tag bg-danger/15 text-danger">封禁</span>
                        ) : (
                          <span className="tag bg-success/15 text-success">正常</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{u.post_count ?? 0}</td>
                      <td className="px-3 py-3 text-text-secondary">{u.comment_count ?? 0}</td>
                      <td className="px-3 py-3 text-text-dim">{formatDateTime(u.created_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="btn-secondary !px-2 !py-1 !text-xs"
                            onClick={() => openVipDialog(u)}
                            disabled={u.is_admin}
                            title={u.is_admin ? '管理员不可操作' : 'VIP 操作'}
                          >
                            <Crown size={12} />
                            VIP
                          </button>
                          <button
                            className="btn-danger !px-2 !py-1 !text-xs"
                            onClick={() => handleBan(u)}
                            disabled={u.is_admin}
                            title={u.is_admin ? '管理员不可封禁' : ''}
                          >
                            <Ban size={12} />
                            {u.is_banned ? '解封' : '封禁'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-dim">共 {total} 条</span>
        <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
      </div>

      {/* VIP 操作对话框 */}
      {vipOpen && vipUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 fade-in"
          onClick={() => setVipOpen(false)}
        >
          <div
            className="card w-full max-w-md space-y-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <ShieldCheck size={18} className="text-gold-400" />
                VIP 操作 - {vipUser.nickname || vipUser.email}
              </h3>
              <button onClick={() => setVipOpen(false)} aria-label="关闭">
                <X size={16} className="text-text-dim hover:text-text-primary" />
              </button>
            </div>

            {/* 操作类型 */}
            <div>
              <p className="mb-2 text-xs text-text-muted">操作类型</p>
              <div className="flex gap-2">
                {(['open', 'renew', 'cancel'] as VipAction[]).map((a) => (
                  <button
                    key={a}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      vipAction === a
                        ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                        : 'border-border-subtle text-text-secondary hover:bg-bg-hover'
                    }`}
                    onClick={() => setVipAction(a)}
                  >
                    {VIP_ACTION_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>

            {/* 天数选择（仅 open/renew 显示）*/}
            {vipAction !== 'cancel' && (
              <div>
                <p className="mb-2 text-xs text-text-muted">开通时长</p>
                <div className="grid grid-cols-4 gap-2">
                  {DAYS_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                        vipDays === p.value
                          ? 'border-gold-400 bg-gold-500/10 text-gold-300'
                          : 'border-border-subtle text-text-secondary hover:bg-bg-hover'
                      }`}
                      onClick={() => setVipDays(p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  className="input-field mt-2"
                  min={1}
                  max={3650}
                  value={vipDays}
                  onChange={(e) => setVipDays(Number(e.target.value) || 0)}
                  placeholder="自定义天数（1-3650）"
                />
              </div>
            )}

            {/* 备注 */}
            <div>
              <p className="mb-2 text-xs text-text-muted">备注（选填）</p>
              <textarea
                className="input-field resize-none"
                rows={2}
                value={vipNote}
                onChange={(e) => setVipNote(e.target.value)}
                placeholder="操作说明，将记录到 VIP 日志"
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setVipOpen(false)}>
                取消
              </button>
              <button
                className="btn-gold"
                onClick={handleVipSubmit}
                disabled={submitting}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
