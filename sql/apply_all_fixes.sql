-- ============================================================
-- 一键修复脚本（合并版）
-- 包含：积分系统 + RLS 递归修复 + 触发器 SECURITY DEFINER
-- 执行位置：Supabase 后台 SQL Editor
-- 执行顺序：从上到下依次执行
-- ============================================================

-- ---------- Part 1：积分系统 ----------

-- 1. user_profile 表新增积分相关字段
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

-- 2. posts 表新增积分解锁费用字段
alter table public.posts
  add column if not exists points_cost integer not null default 0;

comment on column public.posts.points_cost is '查看资源链接所需积分（0=免费公开）';

-- 3. 积分流水表
create table if not exists public.points_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profile(id) on delete cascade,
  change_amount integer not null,
  balance_after integer not null,
  action text not null check (action in (
    'register',
    'invite_reward',
    'invited_bonus',
    'post_reward',
    'comment_reward',
    'unlock_post',
    'admin_adjust'
  )),
  post_id uuid references public.posts(id) on delete set null,
  related_user_id uuid references public.user_profile(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_points_log_user_id on public.points_log(user_id, created_at desc);
create index if not exists idx_points_log_action on public.points_log(action);

-- 4. 邀请关系表
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

-- 5. 资源解锁记录表
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

-- 6. RLS 行级安全策略
alter table public.points_log enable row level security;
alter table public.invite_relation enable row level security;
alter table public.post_unlock enable row level security;

drop policy if exists "points_log_select_own" on public.points_log;
create policy "points_log_select_own" on public.points_log
  for select using (auth.uid() = user_id);

drop policy if exists "invite_relation_select_own" on public.invite_relation;
create policy "invite_relation_select_own" on public.invite_relation
  for select using (auth.uid() = inviter_id or auth.uid() = invitee_id);

drop policy if exists "post_unlock_select_own" on public.post_unlock;
create policy "post_unlock_select_own" on public.post_unlock
  for select using (auth.uid() = user_id);

-- 7. 生成邀请码的函数
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

-- 8. 给新用户自动生成邀请码的触发器
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

-- 为已有用户补充邀请码
update public.user_profile
set invite_code = public.generate_invite_code()
where invite_code is null;

-- 9. 积分变动原子函数
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
  select points into v_balance
  from public.user_profile
  where id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  v_new_balance := v_balance + p_amount;

  if p_amount < 0 and v_new_balance < 0 then
    return false;
  end if;

  update public.user_profile
  set points = v_new_balance,
      total_earned_points = case when p_amount > 0 then total_earned_points + p_amount else total_earned_points end
  where id = p_user_id;

  insert into public.points_log (user_id, change_amount, balance_after, action, post_id, related_user_id, note)
  values (p_user_id, p_amount, v_new_balance, p_action, p_post_id, p_related_user_id, p_note);

  return true;
end;
$$;

-- 10. 邀请人数自增函数
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

-- ---------- Part 2：RLS 递归修复 ----------

-- 11. 创建 is_admin() 安全定义函数
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.user_profile where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- 12. 重写 user_profile 策略
drop policy if exists "profile_read_self_or_admin" on public.user_profile;
create policy "profile_read_self_or_admin" on public.user_profile
    for select using (
        auth.uid() = id
        or public.is_admin()
    );

drop policy if exists "profile_update_self" on public.user_profile;
create policy "profile_update_self" on public.user_profile
    for update using (auth.uid() = id);

-- 13. 重写 posts 策略
drop policy if exists "posts_read_normal" on public.posts;
create policy "posts_read_normal" on public.posts
    for select using (
        status = 'normal'
        or author_id = auth.uid()
        or public.is_admin()
    );

drop policy if exists "posts_insert_auth" on public.posts;
create policy "posts_insert_auth" on public.posts
    for insert with check (author_id = auth.uid());

drop policy if exists "posts_update_owner_admin" on public.posts;
create policy "posts_update_owner_admin" on public.posts
    for update using (
        author_id = auth.uid()
        or public.is_admin()
    );

drop policy if exists "posts_delete_owner_admin" on public.posts;
create policy "posts_delete_owner_admin" on public.posts
    for delete using (
        author_id = auth.uid()
        or public.is_admin()
    );

-- 14. 重写 comments 策略
drop policy if exists "comments_read_all" on public.comments;
create policy "comments_read_all" on public.comments
    for select using (true);

drop policy if exists "comments_insert_auth" on public.comments;
create policy "comments_insert_auth" on public.comments
    for insert with check (user_id = auth.uid());

drop policy if exists "comments_delete_owner_admin" on public.comments;
create policy "comments_delete_owner_admin" on public.comments
    for delete using (
        user_id = auth.uid()
        or public.is_admin()
    );

-- 15. 重写 report 策略
drop policy if exists "report_read_self_admin" on public.report;
create policy "report_read_self_admin" on public.report
    for select using (
        reporter_id = auth.uid()
        or public.is_admin()
    );

drop policy if exists "report_insert_auth" on public.report;
create policy "report_insert_auth" on public.report
    for insert with check (reporter_id = auth.uid());

drop policy if exists "report_update_admin" on public.report;
create policy "report_update_admin" on public.report
    for update using (public.is_admin());

-- 16. 重写 vip_log 策略
drop policy if exists "vip_log_read" on public.vip_log;
create policy "vip_log_read" on public.vip_log
    for select using (
        user_id = auth.uid()
        or operator_id = auth.uid()
        or public.is_admin()
    );

drop policy if exists "vip_log_insert_admin" on public.vip_log;
create policy "vip_log_insert_admin" on public.vip_log
    for insert with check (
        public.is_admin()
        or operator_id = auth.uid()
    );

-- 17. 补齐 increment_post_count / increment_comment_count
create or replace function public.increment_post_count(user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.user_profile
  set post_count = post_count + 1
  where id = user_id;
end;
$$;

create or replace function public.increment_comment_count(user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.user_profile
  set comment_count = comment_count + 1
  where id = user_id;
end;
$$;

-- ---------- Part 3：触发器 SECURITY DEFINER 修复 ----------

-- 18. 修复 update_comment_count
create or replace function public.update_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (tg_op = 'INSERT') then
        update public.posts
            set comment_count = comment_count + 1
            where id = new.post_id;
        update public.user_profile
            set comment_count = comment_count + 1
            where id = new.user_id;
        return new;
    elsif (tg_op = 'DELETE') then
        update public.posts
            set comment_count = greatest(comment_count - 1, 0)
            where id = old.post_id;
        update public.user_profile
            set comment_count = greatest(comment_count - 1, 0)
            where id = old.user_id;
        return old;
    end if;
    return null;
end;
$$;

drop trigger if exists trg_comments_count on public.comments;
create trigger trg_comments_count
    after insert or delete on public.comments
    for each row execute function public.update_comment_count();

-- 19. 修复 update_post_count
create or replace function public.update_post_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (tg_op = 'INSERT') then
        update public.user_profile
            set post_count = post_count + 1
            where id = new.author_id;
        return new;
    elsif (tg_op = 'DELETE') then
        update public.user_profile
            set post_count = greatest(post_count - 1, 0)
            where id = old.author_id;
        return old;
    end if;
    return null;
end;
$$;

drop trigger if exists trg_posts_count on public.posts;
create trigger trg_posts_count
    after insert or delete on public.posts
    for each row execute function public.update_post_count();

-- ============================================================
-- 执行完毕！验证语句：
-- 1. select points_cost from posts limit 1;  -- 确认列存在
-- 2. select policyname, tablename from pg_policies where tablename = 'user_profile';  -- 确认 RLS
-- 3. select proname, prosecdef from pg_proc where proname in ('update_comment_count', 'update_post_count');  -- 确认 SECURITY DEFINER
-- ============================================================
