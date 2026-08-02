-- ============================================================
-- 积分系统数据库迁移脚本
-- 功能：邀请好友送积分 + 积分解锁查看资源链接
-- 执行位置：Supabase 后台 SQL Editor
-- 执行顺序：从上到下依次执行
-- ============================================================

-- ---------- 1. user_profile 表新增积分相关字段 ----------
alter table public.user_profile
  add column if not exists points integer not null default 0,
  add column if not exists total_earned_points integer not null default 0,
  add column if not exists invite_code text unique,
  add column if not exists invited_by uuid references public.user_profile(id) on delete set null,
  add column if not exists invite_count integer not null default 0;

comment on column public.user_profile.points is '当前积分余额';
comment on column public.user_profile.total_earned_points is '累计获得积分（不含消费）';
comment on column public.user_profile.invite_code is '专属邀请码（8位字母数字）';
comment on column public.user_profile.invited_by is '邀请人ID';
comment on column public.user_profile.invite_count is '成功邀请人数';

-- 为已有用户生成邀请码（取 id 前 8 位的大写字母数字）
update public.user_profile
set invite_code = upper(substr(id, 1, 8))
where invite_code is null;

-- ---------- 2. posts 表新增积分解锁费用字段 ----------
alter table public.posts
  add column if not exists points_cost integer not null default 0;

comment on column public.posts.points_cost is '查看资源链接所需积分（0=免费公开）';

-- ---------- 3. 积分流水表 ----------
create table if not exists public.points_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profile(id) on delete cascade,
  change_amount integer not null,
  balance_after integer not null,
  action text not null check (action in (
    'register',        -- 注册奖励
    'invite_reward',   -- 邀请好友奖励
    'invited_bonus',   -- 被邀请奖励
    'post_reward',     -- 发帖奖励
    'comment_reward',  -- 评论奖励
    'unlock_post',     -- 解锁资源消费
    'admin_adjust'     -- 管理员调整
  )),
  post_id uuid references public.posts(id) on delete set null,
  related_user_id uuid references public.user_profile(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_points_log_user_id on public.points_log(user_id, created_at desc);
create index if not exists idx_points_log_action on public.points_log(action);

-- ---------- 4. 邀请关系表 ----------
create table if not exists public.invite_relation (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.user_profile(id) on delete cascade,
  invitee_id uuid not null references public.user_profile(id) on delete cascade,
  invite_code text not null,
  reward_points integer not null default 0,
  status text not null default 'success' check (status in ('success', 'revoked')),
  created_at timestamptz not null default now(),
  unique(invitee_id)
);

create index if not exists idx_invite_relation_inviter on public.invite_relation(inviter_id, created_at desc);

-- ---------- 5. 资源解锁记录表 ----------
create table if not exists public.post_unlock (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profile(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  cost_points integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);

create index if not exists idx_post_unlock_user on public.post_unlock(user_id, created_at desc);
create index if not exists idx_post_unlock_post on public.post_unlock(post_id);

-- ---------- 6. RLS 行级安全策略 ----------
alter table public.points_log enable row level security;
alter table public.invite_relation enable row level security;
alter table public.post_unlock enable row level security;

-- points_log：仅本人可读，仅服务端（service_role）可写
drop policy if exists "points_log_select_own" on public.points_log;
create policy "points_log_select_own" on public.points_log
  for select using (auth.uid() = user_id);

-- invite_relation：邀请人可读自己邀请的记录，被邀请人可读邀请自己的记录
drop policy if exists "invite_relation_select_own" on public.invite_relation;
create policy "invite_relation_select_own" on public.invite_relation
  for select using (auth.uid() = inviter_id or auth.uid() = invitee_id);

-- post_unlock：仅本人可读自己的解锁记录
drop policy if exists "post_unlock_select_own" on public.post_unlock;
create policy "post_unlock_select_own" on public.post_unlock
  for select using (auth.uid() = user_id);

-- ---------- 7. 注册时自动生成邀请码的函数 ----------
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
  exists_flag boolean;
begin
  loop
    result := '';
    for i in 1..8 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.user_profile where invite_code = result) into exists_flag;
    exit when not exists_flag;
  end loop;
  return result;
end;
$$;

-- ---------- 8. 给新用户设置邀请码的触发器 ----------
create or replace function public.handle_invite_code()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.invite_code is null then
    new.invite_code := public.generate_invite_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_profile_invite_code on public.user_profile;
create trigger trg_user_profile_invite_code
  before insert on public.user_profile
  for each row execute function public.handle_invite_code();

-- 为已有用户补充邀请码（触发器只对新增生效，已有数据手动更新）
update public.user_profile
set invite_code = public.generate_invite_code()
where invite_code is null;

-- ---------- 9. 积分变动原子函数（事务安全） ----------
-- 使用 RPC 确保积分扣减/增加的原子性，防止并发超扣
create or replace function public.change_user_points(
  p_user_id uuid,
  p_amount integer,
  p_action text,
  p_post_id uuid default null,
  p_related_user_id uuid default null,
  p_note text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_balance integer;
  v_new_balance integer;
begin
  -- 锁定用户行，防止并发修改
  select points into v_balance
  from public.user_profile
  where id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  v_new_balance := v_balance + p_amount;

  -- 消费时检查余额是否足够
  if p_amount < 0 and v_new_balance < 0 then
    return false;
  end if;

  -- 更新余额
  update public.user_profile
  set points = v_new_balance,
      total_earned_points = case when p_amount > 0 then total_earned_points + p_amount else total_earned_points end
  where id = p_user_id;

  -- 写入流水
  insert into public.points_log (user_id, change_amount, balance_after, action, post_id, related_user_id, note)
  values (p_user_id, p_amount, v_new_balance, p_action, p_post_id, p_related_user_id, p_note);

  return true;
end;
$$;

-- ---------- 10. 邀请人数自增函数 ----------
create or replace function public.increment_invite_count(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.user_profile
  set invite_count = invite_count + 1
  where id = p_user_id;
end;
$$;

