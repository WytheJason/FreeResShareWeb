'use client';

/**
 * VIP 购买客户端组件
 * - 展示4档套餐卡片（月卡/季卡/年卡/永久卡）
 * - 选择支付方式（支付宝/微信/QQ钱包）
 * - 点击开通 → 创建订单 → 跳转易支付页面
 * - 支付完成后轮询订单状态 → 显示开通结果
 * - 邀请好友奖励 VIP 阶梯进度展示
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Crown,
  Check,
  Loader2,
  CreditCard,
  ShieldCheck,
  Clock,
  Gift,
  Users,
  Sparkles,
  PartyPopper,
  ArrowRight,
} from 'lucide-react';
import { VIP_PLANS, INVITE_VIP_REWARDS, type VipPlan, type VipPlanId } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { Spinner } from '@/components/Loading';

// 支付方式
interface PayMethod {
  id: 'alipay' | 'wxpay' | 'qqpay';
  label: string;
  desc: string;
  color: string;
}

const PAY_METHODS: PayMethod[] = [
  { id: 'alipay', label: '支付宝', desc: '推荐使用', color: 'text-blue-400' },
  { id: 'wxpay', label: '微信支付', desc: '扫码支付', color: 'text-green-400' },
  { id: 'qqpay', label: 'QQ钱包', desc: '快捷支付', color: 'text-cyan-400' },
];

interface VipPurchaseClientProps {
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** VIP 是否有效 */
  vipActive: boolean;
  /** VIP 到期时间 */
  vipExpiredAt: string | null;
  /** 邀请人数 */
  inviteCount: number;
}

export default function VipPurchaseClient({
  isLoggedIn,
  vipActive,
  vipExpiredAt,
  inviteCount,
}: VipPurchaseClientProps) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();

  const [selectedPlan, setSelectedPlan] = useState<VipPlanId>('year');
  const [selectedPay, setSelectedPay] = useState<PayMethod['id']>('alipay');
  const [creating, setCreating] = useState(false);

  // 支付完成后的状态轮询
  const [pendingOrderNo, setPendingOrderNo] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // ---------- 检查 URL 中是否有订单号（支付返回后） ----------
  useEffect(() => {
    const orderNo = searchParams.get('order');
    if (orderNo) {
      setPendingOrderNo(orderNo);
      setCheckingStatus(true);
    }
  }, [searchParams]);

  // ---------- 轮询订单状态 ----------
  const checkOrderStatus = useCallback(async (orderNo: string): Promise<void> => {
    try {
      const res = await fetch(`/api/vip/order/status?order_no=${orderNo}`, {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.code === 0 && data.data) {
          if (data.data.status === 'paid') {
            // 支付成功
            setPaymentSuccess(true);
            setCheckingStatus(false);
            toast.show('success', 'VIP 开通成功！');
            // 刷新页面以更新服务端组件
            setTimeout(() => {
              router.refresh();
            }, 2000);
            return;
          }
          // 仍在 pending，继续轮询
          if (data.data.status === 'pending') {
            setTimeout(() => checkOrderStatus(orderNo), 3000);
          } else {
            // expired 或 failed
            setCheckingStatus(false);
            toast.show('error', '支付未完成，请重试');
          }
        }
      }
    } catch {
      // 网络错误，继续重试
      setTimeout(() => checkOrderStatus(orderNo), 3000);
    }
  }, [router, toast]);

  useEffect(() => {
    if (pendingOrderNo && checkingStatus) {
      // 设置超时（60秒后停止轮询）
      const timeout = setTimeout(() => {
        setCheckingStatus(false);
      }, 60000);
      checkOrderStatus(pendingOrderNo);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [pendingOrderNo, checkingStatus, checkOrderStatus]);

  // ---------- 创建订单并跳转支付 ----------
  async function handleCreateOrder() {
    if (!isLoggedIn) {
      router.push('/login?redirect=/vip');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/vip/order/create', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedPlan,
          pay_type: selectedPay,
        }),
      });

      const data = await res.json();

      if (data.code === 0 && data.data?.pay_url) {
        // 跳转到易支付页面
        window.location.href = data.data.pay_url;
      } else {
        toast.show('error', data.message || '创建订单失败');
      }
    } catch {
      toast.show('error', '网络错误，请稍后重试');
    } finally {
      setCreating(false);
    }
  }

  // ---------- 支付成功展示 ----------
  if (paymentSuccess) {
    return (
      <div className="card-gold overflow-hidden">
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/40">
            <PartyPopper className="text-bg-base" size={30} />
          </div>
          <h3 className="mt-4 text-xl font-bold text-text-primary">
            VIP 开通成功！
          </h3>
          <p className="mt-2 text-sm text-text-muted">
            恭喜您成为尊贵的 VIP 会员，所有权益已解锁
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-gold-500/30 bg-gold-500/10 px-4 py-2">
            <Crown size={16} className="text-gold-400" />
            <span className="text-sm font-semibold text-gold-300">
              VIP 已生效
            </span>
          </div>
          <button
            onClick={() => router.push('/')}
            className="btn-gold mt-6"
          >
            开始畅享
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ---------- 支付状态检查中 ----------
  if (checkingStatus && pendingOrderNo) {
    return (
      <div className="card-gold overflow-hidden">
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <Loader2 size={36} className="animate-spin text-gold-400" />
          <h3 className="mt-4 text-sm font-semibold text-text-primary">
            正在确认支付结果...
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            请稍候，系统正在验证您的支付状态
          </p>
          <p className="mt-2 text-xs text-text-dim">
            订单号：{pendingOrderNo}
          </p>
        </div>
      </div>
    );
  }

  // ---------- 套餐选择 + 支付 ----------
  const currentPlan = VIP_PLANS.find((p) => p.id === selectedPlan)!;

  return (
    <div className="space-y-6">
      {/* 邀请好友奖励 VIP 进度 */}
      {isLoggedIn && (
        <div className="card overflow-hidden">
          <div className="border-b border-border bg-bg-elevated/50 px-5 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Gift size={16} className="text-gold-400" />
              邀请好友送 VIP
              <a
                href="/invite"
                className="ml-auto text-xs text-primary-300 hover:underline"
              >
                去邀请 &rarr;
              </a>
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {INVITE_VIP_REWARDS.map((tier) => {
                const reached = inviteCount >= tier.required_count;
                const progress = Math.min(
                  100,
                  (inviteCount / tier.required_count) * 100
                );
                return (
                  <div
                    key={tier.required_count}
                    className={`rounded-lg border p-4 ${
                      reached
                        ? 'border-gold-500/40 bg-gold-500/5'
                        : 'border-border bg-bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <Users size={12} />
                        邀请 {tier.required_count} 人
                      </span>
                      {reached && (
                        <Check size={14} className="text-gold-400" />
                      )}
                    </div>
                    <p className="mt-1 text-sm font-bold text-gold-300">
                      +{tier.reward_days} 天 VIP
                    </p>
                    {/* 进度条 */}
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                      <div
                        className={`h-full rounded-full transition-all ${
                          reached ? 'bg-gold-500' : 'bg-primary-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-dim">
                      {inviteCount} / {tier.required_count}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 套餐选择 */}
      <div className="card-gold overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gold-500/30 bg-gold-500/10 px-6 py-4">
          <Crown size={18} className="text-gold-400" />
          <h2 className="text-lg font-bold text-text-primary">选择 VIP 套餐</h2>
          {vipActive && vipExpiredAt && (
            <span className="ml-auto flex items-center gap-1 rounded-full border border-gold-500/30 bg-gold-500/15 px-2.5 py-1 text-xs text-gold-300">
              <Clock size={10} />
              当前 VIP 有效
            </span>
          )}
        </div>

        <div className="p-6">
          {/* 套餐卡片网格 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {VIP_PLANS.map((plan) => {
              const active = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                    active
                      ? 'border-gold-500 bg-gold-500/10 shadow-lg shadow-gold-500/10'
                      : 'border-border bg-bg-surface hover:border-gold-500/40'
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-3 py-0.5 text-[10px] font-bold text-bg-base">
                      推荐
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-text-primary">
                      {plan.name}
                    </h4>
                    {active && (
                      <div className="grid h-5 w-5 place-items-center rounded-full bg-gold-500 text-bg-base">
                        <Check size={12} />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-xs text-text-muted">¥</span>
                    <span className="text-2xl font-bold text-gold-300">
                      {plan.price}
                    </span>
                  </div>
                  {plan.original_price && (
                    <span className="text-xs text-text-dim line-through">
                      ¥{plan.original_price}
                    </span>
                  )}
                  <p className="mt-2 text-xs text-text-muted">{plan.desc}</p>
                  <div className="mt-2 text-xs text-text-dim">
                    {plan.days ? `${plan.days} 天` : '永久有效'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 支付方式选择 */}
          <div className="mt-6">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
              <CreditCard size={14} />
              选择支付方式
            </label>
            <div className="grid grid-cols-3 gap-3">
              {PAY_METHODS.map((method) => {
                const active = selectedPay === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPay(method.id)}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 transition-all ${
                      active
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-border bg-bg-surface hover:border-primary-500/40'
                    }`}
                  >
                    <span className={`text-sm font-medium ${active ? method.color : 'text-text-secondary'}`}>
                      {method.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 订单摘要 + 开通按钮 */}
          <div className="mt-6 rounded-lg border border-border bg-bg-surface p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">套餐</span>
              <span className="font-medium text-text-primary">
                VIP {currentPlan.name}
                <span className="ml-1 text-xs text-text-dim">
                  ({currentPlan.days ? `${currentPlan.days} 天` : '永久'})
                </span>
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-text-muted">应付金额</span>
              <span className="text-lg font-bold text-gold-300">
                ¥{currentPlan.price}
              </span>
            </div>
          </div>

          <button
            onClick={handleCreateOrder}
            disabled={creating}
            className="btn-gold mt-4 w-full"
          >
            {creating ? (
              <>
                <Spinner />
                正在创建订单...
              </>
            ) : (
              <>
                <Crown size={16} />
                立即开通 VIP
              </>
            )}
          </button>

          {/* 安全保障 */}
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-text-dim">
            <span className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-green-400" />
              安全支付
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-blue-400" />
              即时生效
            </span>
            <span className="flex items-center gap-1">
              <Sparkles size={12} className="text-gold-400" />
              续费叠加时长
            </span>
          </div>
        </div>
      </div>

      {/* VIP 时效说明 */}
      <div className="card p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <ShieldCheck size={14} className="text-gold-400" />
          VIP 时效说明
        </h3>
        <ul className="mt-3 space-y-2 text-xs leading-6 text-text-muted">
          <li>
            • <span className="text-text-secondary">限时 VIP</span>
            ：可选 30 天 / 90 天 / 365 天，到期后自动失效，可随时续费恢复。
          </li>
          <li>
            • <span className="text-text-secondary">永久 VIP</span>
            ：vip_expired_at 设置为 2099-12-31，一次开通终身有效。
          </li>
          <li>
            • <span className="text-text-secondary">自动降级</span>
            ：限时 VIP 到期后系统自动降级为普通用户，加密资源将无法查看。
          </li>
          <li>
            • <span className="text-text-secondary">续费叠加</span>
            ：在 VIP 有效期内续费，时长会在原到期时间基础上叠加。
          </li>
          <li>
            • <span className="text-text-secondary">邀请奖励</span>
            ：邀请 5 人送 15 天、15 人送 90 天、20 人送 180 天 VIP。
          </li>
        </ul>
      </div>
    </div>
  );
}
