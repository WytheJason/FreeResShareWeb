-- ============================================================
-- VIP 在线付费功能数据库迁移脚本
-- 包含：VIP订单表、邀请VIP奖励记录表
-- 执行位置：Supabase 后台 SQL Editor
-- ============================================================

-- ---------- 1. VIP 订单表 ----------
-- 记录用户通过在线支付开通/续费 VIP 的订单
create table if not exists public.vip_order (
  id uuid primary key default gen_random_uuid(),
  -- 订单号（业务唯一，易支付 out_trade_no）
  order_no text not null unique,
  -- 用户ID
  user_id uuid not null references public.user_profile(id) on delete cascade,
  -- 套餐ID：month / quarter / year / permanent
  plan_id text not null check (plan_id in ('month', 'quarter', 'year', 'permanent')),
  -- 套餐名称（冗余存储，避免后续改价后历史订单显示不一致）
  plan_name text not null,
  -- 支付金额（元）
  amount numeric(10, 2) not null,
  -- VIP 天数（null 表示永久）
  days integer,
  -- 套餐类型：limited(限时) / permanent(永久)
  plan_type text not null check (plan_type in ('limited', 'permanent')),
  -- 支付方式：alipay / wxpay / qqpay
  pay_type text,
  -- 订单状态：pending(待支付) / paid(已支付) / expired(已过期) / failed(失败)
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'failed')),
  -- 易支付返回的交易号
  trade_no text,
  -- 支付完成时间
  paid_at timestamptz,
  -- 创建时间
  created_at timestamptz not null default now(),
  -- 更新时间
  updated_at timestamptz not null default now()
);

create index if not exists idx_vip_order_user on public.vip_order(user_id, created_at desc);
create index if not exists idx_vip_order_status on public.vip_order(status);
create index if not exists idx_vip_order_no on public.vip_order(order_no);

-- ---------- 2. 邀请 VIP 奖励记录表 ----------
-- 记录用户通过邀请好友达到阶梯后获得的 VIP 奖励
-- 每个阶梯只能领取一次，避免重复发放
create table if not exists public.invite_vip_reward (
  id uuid primary key default gen_random_uuid(),
  -- 用户ID（获得奖励的用户）
  user_id uuid not null references public.user_profile(id) on delete cascade,
  -- 邀请人数阶梯（5 / 15 / 20）
  required_count integer not null,
  -- 奖励 VIP 天数
  reward_days integer not null,
  -- 发放状态：granted(已发放) / revoked(已撤销)
  status text not null default 'granted' check (status in ('granted', 'revoked')),
  -- 发放时间
  granted_at timestamptz not null default now(),
  -- 每个用户每个阶梯只能领取一次
  unique(user_id, required_count)
);

create index if not exists idx_invite_vip_reward_user on public.invite_vip_reward(user_id);

-- ---------- 3. RLS 策略 ----------
alter table public.vip_order enable row level security;
alter table public.invite_vip_reward enable row level security;

-- vip_order：仅本人可读自己的订单，仅服务端（service_role）可写
drop policy if exists "vip_order_select_own" on public.vip_order;
create policy "vip_order_select_own" on public.vip_order
  for select using (auth.uid() = user_id);

-- invite_vip_reward：仅本人可读
drop policy if exists "invite_vip_reward_select_own" on public.invite_vip_reward;
create policy "invite_vip_reward_select_own" on public.invite_vip_reward
  for select using (auth.uid() = user_id);

-- ---------- 4. 触发器：自动更新 updated_at ----------
create or replace function public.update_vip_order_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_vip_order_updated_at on public.vip_order;
create trigger trg_vip_order_updated_at
    before update on public.vip_order
    for each row execute function public.update_vip_order_updated_at();

-- ---------- 完成提示 ----------
-- 验证语句：
-- select column_name, data_type from information_schema.columns where table_name = 'vip_order';
-- select column_name, data_type from information_schema.columns where table_name = 'invite_vip_reward';
