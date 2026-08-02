'use client';

/**
 * 邀请好友页（客户端组件）
 * - 未登录自动跳转登录页
 * - 展示邀请码 / 邀请链接，一键复制
 * - 邀请链接生成二维码（纯前端 Canvas 本地生成，不请求外部服务）
 * - 展示邀请记录与积分规则
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Copy,
  Check,
  Users,
  Gift,
  Coins,
  TrendingUp,
  Download,
  RefreshCw,
  UserPlus,
  Crown,
  Clock,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { Spinner } from '@/components/Loading';
import {
  POINT_RULES,
  INVITE_VIP_REWARDS,
  type InviteInfo,
} from '@/lib/types';

export default function InvitePage() {
  const router = useRouter();
  const toast = useToast();

  const [checking, setChecking] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<'code' | 'url' | null>(null);

  // 二维码相关
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);
  const [qrError, setQrError] = useState(false);

  // 邀请VIP奖励状态
  const [vipReward, setVipReward] = useState<{
    tiers: Array<{
      required_count: number;
      reward_days: number;
      status: 'granted' | 'available' | 'locked';
      granted_at?: string;
    }>;
    vip_active: boolean;
    vip_expired_at: string | null;
    newly_granted_days: number;
  } | null>(null);
  const [loadingVipReward, setLoadingVipReward] = useState(false);

  // ---------- 登录态检查 ----------
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login?redirect=/invite');
        return;
      }
      setChecking(false);
    });
  }, [router]);

  // ---------- 拉取邀请信息 ----------
  async function loadInviteInfo() {
    setLoading(true);
    try {
      const res = await fetch('/api/invite/info', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data.code === 0 && data.data) {
          setInviteInfo(data.data);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (checking) return;
    loadInviteInfo();
    loadVipReward();
  }, [checking]);

  // ---------- 加载邀请VIP奖励 ----------
  async function loadVipReward() {
    setLoadingVipReward(true);
    try {
      const res = await fetch('/api/vip/invite-reward/check', {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.code === 0 && data.data) {
          setVipReward(data.data);
          // 如果有新发放的奖励，显示提示
          if (data.data.newly_granted_days > 0) {
            toast.show(
              'success',
              `恭喜！邀请奖励 ${data.data.newly_granted_days} 天 VIP 已发放`
            );
          }
        }
      }
    } catch {
      // 忽略
    } finally {
      setLoadingVipReward(false);
    }
  }

  // ---------- 生成二维码 ----------
  useEffect(() => {
    if (!inviteInfo?.invite_url || !canvasRef.current) return;

    setQrReady(false);
    setQrError(false);

    QRCode.toCanvas(
      canvasRef.current,
      inviteInfo.invite_url,
      {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a', // 深色码点（适配深色主题背景的对比）
          light: '#ffffff', // 白色背景确保可扫描
        },
        errorCorrectionLevel: 'M',
      },
      (error) => {
        if (error) {
          console.error('[QRCode] 生成失败', error);
          setQrError(true);
        } else {
          setQrReady(true);
        }
      }
    );
  }, [inviteInfo?.invite_url]);

  // ---------- 复制 ----------
  async function copyText(text: string, field: 'code' | 'url') {
    try {
      await navigator.clipboard.writeText(text);
      toast.show('success', field === 'code' ? '邀请码已复制' : '邀请链接已复制');
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.show('error', '复制失败，请手动复制');
    }
  }

  // ---------- 下载二维码 ----------
  function downloadQRCode() {
    if (!canvasRef.current || !qrReady) return;
    try {
      const url = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `invite-qr-${inviteInfo?.invite_code ?? 'code'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.show('success', '二维码已保存');
    } catch {
      toast.show('error', '下载失败，请右键另存图片');
    }
  }

  // ---------- 格式化日期 ----------
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // 登录校验中
  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* 返回首页 */}
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-primary-300"
      >
        <ArrowLeft size={12} />
        返回首页
      </Link>

      {/* 页头 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-600/30">
          <UserPlus className="text-white" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">邀请好友赚积分</h1>
          <p className="text-xs text-text-muted">
            分享专属链接，好友注册成功双方均获积分奖励
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : inviteInfo ? (
        <div className="space-y-6">
          {/* ---------- 统计卡片 ---------- */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Users size={14} className="text-blue-400" />
                邀请人数
              </div>
              <div className="mt-1 text-2xl font-bold text-blue-300">
                {inviteInfo.invite_count}
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Coins size={14} className="text-purple-400" />
                邀请积分
              </div>
              <div className="mt-1 text-2xl font-bold text-purple-300">
                {inviteInfo.total_invite_points}
              </div>
            </div>
            <div className="card col-span-2 p-4 md:col-span-1">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Gift size={14} className="text-green-400" />
                每次奖励
              </div>
              <div className="mt-1 text-2xl font-bold text-green-300">
                +{POINT_RULES.INVITE_REWARD}
              </div>
            </div>
          </div>

          {/* ---------- 邀请 VIP 奖励阶梯 ---------- */}
          <div className="card overflow-hidden border-gold-500/20">
            <div className="border-b border-border bg-gold-500/5 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Crown size={16} className="text-gold-400" />
                邀请好友送 VIP 会员
                {vipReward?.vip_active && (
                  <span className="ml-auto flex items-center gap-1 rounded-full border border-gold-500/30 bg-gold-500/15 px-2 py-0.5 text-xs text-gold-300">
                    <Clock size={10} />
                    VIP 有效
                  </span>
                )}
              </h3>
            </div>
            <div className="p-5">
              {loadingVipReward ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : vipReward ? (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {vipReward.tiers.map((tier) => {
                      const inviteCount = inviteInfo?.invite_count ?? 0;
                      const progress = Math.min(
                        100,
                        (inviteCount / tier.required_count) * 100
                      );
                      const isGranted = tier.status === 'granted';
                      const isAvailable = tier.status === 'available';

                      return (
                        <div
                          key={tier.required_count}
                          className={`rounded-lg border-2 p-4 transition-all ${
                            isGranted
                              ? 'border-gold-500/40 bg-gold-500/5'
                              : isAvailable
                              ? 'border-primary-500/40 bg-primary-500/5'
                              : 'border-border bg-bg-surface'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-xs text-text-muted">
                              <Users size={12} />
                              邀请 {tier.required_count} 人
                            </span>
                            {isGranted && (
                              <span className="flex items-center gap-0.5 rounded-full bg-gold-500/15 px-2 py-0.5 text-xs text-gold-300">
                                <Check size={10} />
                                已领取
                              </span>
                            )}
                            {isAvailable && (
                              <span className="flex items-center gap-0.5 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-300">
                                <Crown size={10} />
                                已达成
                              </span>
                            )}
                          </div>
                          <p className="mt-1 flex items-baseline gap-1">
                            <Crown size={14} className="text-gold-400" />
                            <span className="text-sm font-bold text-gold-300">
                              +{tier.reward_days} 天 VIP
                            </span>
                          </p>
                          {/* 进度条 */}
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-elevated">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isGranted
                                  ? 'bg-gold-500'
                                  : isAvailable
                                  ? 'bg-green-500'
                                  : 'bg-primary-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-text-dim">
                            {inviteCount} / {tier.required_count} 人
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* VIP 到期时间提示 */}
                  {vipReward.vip_expired_at && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-gold-500/20 bg-gold-500/5 p-3 text-xs">
                      <Clock size={14} className="text-gold-400" />
                      <span className="text-text-muted">
                        {vipReward.vip_active ? 'VIP 到期时间' : 'VIP 已过期'}：
                      </span>
                      <span className="font-medium text-text-primary">
                        {formatDate(vipReward.vip_expired_at)}
                      </span>
                    </div>
                  )}

                  {/* 奖励规则说明 */}
                  <div className="mt-3 rounded-lg border border-border bg-bg-surface p-3 text-xs text-text-muted">
                    <p className="flex items-center gap-1 font-semibold text-gold-300">
                      <Gift size={12} />
                      奖励规则
                    </p>
                    <ul className="mt-2 space-y-1">
                      <li>• 邀请 5 人：赠送 15 天 VIP 会员</li>
                      <li>• 邀请 15 人：赠送 90 天 VIP 会员</li>
                      <li>• 邀请 20 人：赠送 180 天 VIP 会员</li>
                      <li>• 达成条件后自动发放，VIP 天数可叠加</li>
                    </ul>
                  </div>
                </>
              ) : (
                <p className="py-4 text-center text-sm text-text-muted">
                  加载失败，请刷新重试
                </p>
              )}
            </div>
          </div>

          {/* ---------- 邀请码 & 链接 & 二维码 ---------- */}
          <div className="card overflow-hidden">
            <div className="border-b border-border bg-bg-elevated/50 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <UserPlus size={16} className="text-primary-400" />
                我的邀请码
              </h3>
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-2">
              {/* 左侧：邀请码和链接 */}
              <div className="space-y-4">
                {/* 邀请码 */}
                <div>
                  <label className="mb-1 block text-xs text-text-muted">邀请码</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-bg-elevated px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-primary-300">
                      {inviteInfo.invite_code || '未生成'}
                    </code>
                    <button
                      onClick={() => copyText(inviteInfo.invite_code, 'code')}
                      className="btn-secondary shrink-0"
                      aria-label="复制邀请码"
                    >
                      {copiedField === 'code' ? (
                        <Check size={16} className="text-green-400" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {/* 邀请链接 */}
                <div>
                  <label className="mb-1 block text-xs text-text-muted">邀请链接</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg bg-bg-elevated px-3 py-3 text-xs text-text-secondary">
                      {inviteInfo.invite_url}
                    </code>
                    <button
                      onClick={() => copyText(inviteInfo.invite_url, 'url')}
                      className="btn-secondary shrink-0"
                      aria-label="复制邀请链接"
                    >
                      {copiedField === 'url' ? (
                        <Check size={16} className="text-green-400" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {/* 积分规则 */}
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                  <p className="flex items-center gap-1 text-xs font-semibold text-purple-300">
                    <Gift size={12} />
                    奖励规则
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-text-muted">
                    <li>• 好友通过你的链接注册，你 +{POINT_RULES.INVITE_REWARD} 积分</li>
                    <li>• 好友注册成功，好友额外 +{POINT_RULES.INVITED_BONUS} 积分</li>
                    <li>• 积分可用于解锁付费资源链接</li>
                  </ul>
                </div>
              </div>

              {/* 右侧：二维码 */}
              <div className="flex flex-col items-center">
                <label className="mb-2 block text-xs text-text-muted">
                  邀请二维码
                </label>
                <div className="relative rounded-xl border border-border bg-white p-3">
                  {qrError ? (
                    <div className="flex h-[240px] w-[240px] flex-col items-center justify-center gap-2 text-text-muted">
                      <RefreshCw size={24} />
                      <span className="text-xs">二维码生成失败</span>
                      <button
                        onClick={loadInviteInfo}
                        className="text-xs text-primary-300 hover:underline"
                      >
                        重新加载
                      </button>
                    </div>
                  ) : (
                    <>
                      <canvas ref={canvasRef} className="block" />
                      {!qrReady && (
                        <div className="absolute inset-3 flex items-center justify-center bg-white">
                          <Spinner />
                        </div>
                      )}
                    </>
                  )}
                </div>
                {qrReady && (
                  <button
                    onClick={downloadQRCode}
                    className="btn-secondary mt-3 flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    保存二维码
                  </button>
                )}
                <p className="mt-2 text-center text-xs text-text-dim">
                  扫码即可前往注册页
                </p>
              </div>
            </div>
          </div>

          {/* ---------- 邀请记录 ---------- */}
          <div className="card overflow-hidden">
            <div className="border-b border-border bg-bg-elevated/50 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <TrendingUp size={16} className="text-green-400" />
                邀请记录
                {inviteInfo.recent_invites.length > 0 && (
                  <span className="ml-1 text-xs font-normal text-text-muted">
                    （共 {inviteInfo.invite_count} 人）
                  </span>
                )}
              </h3>
            </div>
            <div className="p-5">
              {inviteInfo.recent_invites.length === 0 ? (
                <div className="py-10 text-center">
                  <Users className="mx-auto text-text-dim" size={36} />
                  <p className="mt-2 text-sm text-text-muted">
                    还没有邀请记录
                  </p>
                  <p className="mt-1 text-xs text-text-dim">
                    复制上方链接或二维码分享给好友吧
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inviteInfo.recent_invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center gap-3 rounded-lg bg-bg-elevated/50 px-3 py-2.5"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg-surface text-xs text-text-secondary">
                        {invite.invitee_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={invite.invitee_avatar}
                            alt=""
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <span>{invite.invitee_nickname?.[0] ?? '?'}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-text-primary">
                          {invite.invitee_nickname}
                        </div>
                        <div className="text-xs text-text-dim">
                          {formatDate(invite.created_at)}
                        </div>
                      </div>
                      {invite.status === 'success' ? (
                        <span className="shrink-0 text-sm font-bold text-green-400">
                          +{invite.reward_points}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-text-dim">
                          已撤销
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card py-16 text-center">
          <p className="text-sm text-text-muted">加载失败，请刷新重试</p>
          <button onClick={loadInviteInfo} className="btn-secondary mt-3">
            重新加载
          </button>
        </div>
      )}
    </div>
  );
}
