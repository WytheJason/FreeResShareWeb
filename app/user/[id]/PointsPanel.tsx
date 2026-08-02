'use client';

/**
 * 积分面板组件
 * - 展示当前积分余额、累计获得积分
 * - 邀请好友模块：邀请码、邀请链接、复制按钮、邀请记录列表
 * - 积分明细：分页加载积分流水记录
 */

import { useEffect, useCallback, useState } from 'react';
import {
  Coins,
  Copy,
  Users,
  Gift,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Spinner } from '@/components/Loading';
import {
  POINT_ACTION_LABELS,
  type PointLog,
  type InviteInfo,
  type UserProfile,
} from '@/lib/types';

interface PointsPanelProps {
  profile: UserProfile;
  isOwner: boolean;
}

const LOG_PAGE_SIZE = 10;

export default function PointsPanel({ profile, isOwner }: PointsPanelProps) {
  const toast = useToast();
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);

  // 积分明细
  const [logs, setLogs] = useState<PointLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [copied, setCopied] = useState(false);

  // ---------- 加载邀请信息 ----------
  const loadInviteInfo = useCallback(async () => {
    if (!isOwner) return;
    setLoadingInvite(true);
    try {
      const res = await fetch('/api/invite/info', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data.code === 0 && data.data) {
          setInviteInfo(data.data);
        }
      }
    } catch {
      // 忽略
    } finally {
      setLoadingInvite(false);
    }
  }, [isOwner]);

  // ---------- 加载积分流水 ----------
  const loadLogs = useCallback(
    async (page: number) => {
      setLoadingLogs(true);
      try {
        const res = await fetch(`/api/points/log?page=${page}&page_size=${LOG_PAGE_SIZE}`, {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.code === 0 && data.data) {
            setLogs(data.data.list ?? []);
            setLogTotal(data.data.total ?? 0);
            setLogTotalPages(data.data.total_pages ?? 1);
          }
        }
      } catch {
        // 忽略
      } finally {
        setLoadingLogs(false);
      }
    },
    []
  );

  useEffect(() => {
    loadInviteInfo();
    loadLogs(1);
  }, [loadInviteInfo, loadLogs]);

  // ---------- 复制邀请码/链接 ----------
  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.show('success', `${label}已复制`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.show('error', '复制失败，请手动复制');
    }
  }

  // ---------- 格式化日期 ----------
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // 非本人不显示
  if (!isOwner) {
    return (
      <div className="card p-8 text-center">
        <Coins className="mx-auto text-text-dim" size={40} />
        <p className="mt-3 text-sm text-text-muted">积分明细仅本人可见</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------- 积分总览 ---------- */}
      <div className="card overflow-hidden">
        <div className="border-b border-border bg-bg-elevated/50 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Coins size={16} className="text-purple-400" />
            我的积分
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-3">
          <div className="rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 p-4">
            <div className="text-xs text-text-muted">当前积分</div>
            <div className="mt-1 text-2xl font-bold text-purple-300">
              {profile.points ?? 0}
            </div>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/10 p-4">
            <div className="text-xs text-text-muted">累计获得</div>
            <div className="mt-1 text-2xl font-bold text-green-300">
              {profile.total_earned_points ?? 0}
            </div>
          </div>
          <div className="col-span-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 p-4 md:col-span-1">
            <div className="text-xs text-text-muted">邀请人数</div>
            <div className="mt-1 text-2xl font-bold text-blue-300">
              {profile.invite_count ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- 邀请好友 ---------- */}
      <div className="card overflow-hidden">
        <div className="border-b border-border bg-bg-elevated/50 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Users size={16} className="text-blue-400" />
            邀请好友赚积分
          </h3>
        </div>
        <div className="p-5">
          {loadingInvite ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : inviteInfo ? (
            <>
              {/* 邀请码和链接 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-text-muted">邀请码</span>
                  <div className="flex flex-1 items-center gap-2">
                    <code className="flex-1 rounded-md bg-bg-elevated px-3 py-2 text-sm font-bold tracking-wider text-text-primary">
                      {inviteInfo.invite_code || '未生成'}
                    </code>
                    <button
                      onClick={() => copyText(inviteInfo.invite_code, '邀请码')}
                      className="btn-secondary shrink-0"
                      aria-label="复制邀请码"
                    >
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-text-muted">邀请链接</span>
                  <div className="flex flex-1 items-center gap-2">
                    <code className="flex-1 truncate rounded-md bg-bg-elevated px-3 py-2 text-xs text-text-secondary">
                      {inviteInfo.invite_url}
                    </code>
                    <button
                      onClick={() => copyText(inviteInfo.invite_url, '邀请链接')}
                      className="btn-secondary shrink-0"
                      aria-label="复制邀请链接"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 积分规则提示 */}
              <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-text-secondary">
                <p className="flex items-center gap-1 font-semibold text-purple-300">
                  <Gift size={12} />
                  积分规则
                </p>
                <ul className="mt-2 space-y-1 text-text-muted">
                  <li>• 邀请好友注册，双方均可获得积分奖励</li>
                  <li>• 发布资源、评论可获得积分</li>
                  <li>• 积分可用于解锁付费资源链接</li>
                </ul>
              </div>

              {/* 邀请记录 */}
              {inviteInfo.recent_invites.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-text-muted">
                      最近邀请（共 {inviteInfo.invite_count} 人，获得 {inviteInfo.total_invite_points} 积分）
                    </span>
                  </div>
                  <div className="space-y-2">
                    {inviteInfo.recent_invites.slice(0, 5).map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center gap-3 rounded-lg bg-bg-elevated/50 px-3 py-2"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg-surface text-xs text-text-secondary">
                          {invite.invitee_avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={invite.invitee_avatar}
                              alt=""
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-xs">
                              {invite.invitee_nickname?.[0] ?? '?'}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-text-primary">
                            {invite.invitee_nickname}
                          </div>
                          <div className="text-xs text-text-dim">{formatDate(invite.created_at)}</div>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-green-400">
                          +{invite.reward_points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="py-4 text-center text-sm text-text-muted">加载失败，请刷新重试</p>
          )}
        </div>
      </div>

      {/* ---------- 积分明细 ---------- */}
      <div className="card overflow-hidden">
        <div className="border-b border-border bg-bg-elevated/50 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <TrendingUp size={16} className="text-green-400" />
            积分明细
          </h3>
        </div>
        <div className="p-5">
          {loadingLogs && logPage === 1 ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">暂无积分记录</p>
          ) : (
            <>
              <div className="space-y-2">
                {logs.map((log) => {
                  const isIncome = log.change_amount > 0;
                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 rounded-lg bg-bg-elevated/50 px-3 py-2.5"
                    >
                      <div
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                          isIncome
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-purple-500/15 text-purple-400'
                        }`}
                      >
                        {isIncome ? <Gift size={16} /> : <Coins size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-text-primary">
                          {POINT_ACTION_LABELS[log.action] || log.action}
                        </div>
                        <div className="text-xs text-text-dim">
                          {log.note || formatDate(log.created_at)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={`text-sm font-bold ${
                            isIncome ? 'text-green-400' : 'text-purple-400'
                          }`}
                        >
                          {isIncome ? '+' : ''}
                          {log.change_amount}
                        </div>
                        <div className="text-xs text-text-dim">余额 {log.balance_after}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 分页 */}
              {logTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      const p = Math.max(1, logPage - 1);
                      if (p !== logPage) {
                        setLogPage(p);
                        loadLogs(p);
                      }
                    }}
                    disabled={logPage <= 1}
                    className="btn-secondary px-2 py-1 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-text-muted">
                    {logPage} / {logTotalPages}
                  </span>
                  <button
                    onClick={() => {
                      const p = Math.min(logTotalPages, logPage + 1);
                      if (p !== logPage) {
                        setLogPage(p);
                        loadLogs(p);
                      }
                    }}
                    disabled={logPage >= logTotalPages}
                    className="btn-secondary px-2 py-1 disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
