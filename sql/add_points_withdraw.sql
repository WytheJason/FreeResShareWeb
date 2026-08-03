-- ============================================================
-- 积分兑现功能数据库迁移脚本
-- 执行位置：Supabase Dashboard > SQL Editor
-- 说明：创建积分兑换记录表，扩展 points_log 动作类型
-- ============================================================

-- ---------- 1. 扩展 points_log.action 约束，新增 withdraw / withdraw_refund ----------
-- 先删除旧约束，再创建包含新动作的约束
alter table public.points_log
  drop constraint if exists points_log_action_check;

alter table public.points_log
  add constraint points_log_action_check check (action in (
    'register', 'invite_reward', 'invited_bonus',
    'post_reward', 'comment_reward', 'unlock_post',
    'admin_adjust', 'withdraw', 'withdraw_refund'
  ));

-- ---------- 2. 积分兑换记录表 ----------
create table if not exists public.points_withdraw (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profile(id) on delete cascade,
  -- 兑换档位：积分数量
  points_cost integer not null check (points_cost > 0),
  -- 兑换金额（元）
  amount numeric(10, 2) not null check (amount > 0),
  -- 收款方式：alipay / wxpay
  payment_method text not null check (payment_method in ('alipay', 'wxpay')),
  -- 收款账号（支付宝邮箱/手机号，或微信号）
  payment_account text not null,
  -- 收款人姓名（实名）
  payment_name text not null,
  -- 状态：pending(待处理) / approved(已通过) / rejected(已拒绝) / paid(已打款)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  -- 管理员备注（拒绝理由等）
  admin_note text,
  -- 处理时间
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 索引：按用户查询、按状态筛选
create index if not exists idx_points_withdraw_user_id
  on public.points_withdraw(user_id, created_at desc);
create index if not exists idx_points_withdraw_status
  on public.points_withdraw(status, created_at desc);

-- ---------- 3. RLS 策略 ----------
alter table public.points_withdraw enable row level security;

-- 用户只能查看自己的兑换记录
create policy "用户查看自己的兑换记录"
  on public.points_withdraw for select
  using (auth.uid() = user_id);

-- 用户不能直接插入/修改兑换记录（由 service_role 通过 API 操作）
-- 不创建 insert/update/delete 策略，确保所有写入必须经过 API（带鉴权 + 积分扣减）

-- ---------- 4. 更新触发器：updated_at ----------
create or replace function public.update_points_withdraw_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_points_withdraw_updated on public.points_withdraw;
create trigger trg_points_withdraw_updated
  before update on public.points_withdraw
  for each row execute function public.update_points_withdraw_timestamp();

-- ---------- 5. 验证 ----------
-- 检查表是否创建成功
-- select table_name from information_schema.tables where table_name = 'points_withdraw';
-- 检查约束是否更新
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'points_log_action_check';
