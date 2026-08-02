-- ============================================================================
-- 软件/影视网盘资源分享论坛 - Supabase 数据库完整初始化脚本
-- 使用方式：登录 Supabase Dashboard > SQL Editor > 粘贴本脚本 > Run
-- 一键执行：建表 + 索引 + 触发器 + RLS 策略 + Storage 桶
-- ============================================================================

-- 启用 pgcrypto 扩展（提供 gen_random_uuid）
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. user_profile 用户资料扩展表（关联 auth.users）
-- ============================================================================
create table if not exists public.user_profile (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    nickname text not null default '',
    avatar text not null default '',
    bio text not null default '',
    is_admin boolean not null default false,
    is_vip boolean not null default false,
    vip_started_at timestamptz,
    vip_expired_at timestamptz,
    is_banned boolean not null default false,
    post_count integer not null default 0,
    comment_count integer not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_user_profile_email on public.user_profile(email);
create index if not exists idx_user_profile_is_vip on public.user_profile(is_vip);
create index if not exists idx_user_profile_is_admin on public.user_profile(is_admin);

-- ============================================================================
-- 2. posts 资源帖子主表（软件/影视）
-- ============================================================================
create table if not exists public.posts (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text not null default '',
    cover_url text not null default '',
    category text not null check (category in ('software','movie')),
    pan_type text not null check (pan_type in ('baidu','aliyun','quark')),
    pan_url text not null,
    pan_code text not null default '',
    is_vip boolean not null default false,
    is_top boolean not null default false,
    hot_weight integer not null default 0,
    status text not null default 'normal' check (status in ('normal','pending','hidden')),
    view_count integer not null default 0,
    comment_count integer not null default 0,
    author_id uuid not null references public.user_profile(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_posts_status_created on public.posts(status, created_at desc);
create index if not exists idx_posts_category on public.posts(category);
create index if not exists idx_posts_is_top on public.posts(is_top);
create index if not exists idx_posts_author on public.posts(author_id);
create index if not exists idx_posts_is_vip on public.posts(is_vip);
-- 全文搜索索引（标题模糊搜索）
create index if not exists idx_posts_title on public.posts using gin(to_tsvector('simple', title));

-- ============================================================================
-- 3. comments 多层嵌套评论表（楼中楼）
-- ============================================================================
create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.posts(id) on delete cascade,
    parent_id uuid references public.comments(id) on delete cascade,
    reply_to_id uuid references public.comments(id) on delete set null,
    reply_to_nickname text,
    content text not null,
    user_id uuid not null references public.user_profile(id) on delete cascade,
    created_at timestamptz not null default now()
);
create index if not exists idx_comments_post on public.comments(post_id, created_at desc);
create index if not exists idx_comments_parent on public.comments(parent_id);
create index if not exists idx_comments_user on public.comments(user_id);

-- ============================================================================
-- 4. report 用户举报记录表
-- ============================================================================
create table if not exists public.report (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.posts(id) on delete cascade,
    reporter_id uuid not null references public.user_profile(id) on delete cascade,
    reason text not null,
    status text not null default 'pending' check (status in ('pending','handled','archived')),
    handle_note text,
    created_at timestamptz not null default now(),
    handled_at timestamptz
);
create index if not exists idx_report_status on public.report(status);
create index if not exists idx_report_post on public.report(post_id);

-- ============================================================================
-- 5. collect 用户收藏关联表
-- ============================================================================
create table if not exists public.collect (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_profile(id) on delete cascade,
    post_id uuid not null references public.posts(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique(user_id, post_id)
);
create index if not exists idx_collect_user on public.collect(user_id, created_at desc);
create index if not exists idx_collect_post on public.collect(post_id);

-- ============================================================================
-- 6. vip_log VIP 操作日志表
-- ============================================================================
create table if not exists public.vip_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_profile(id) on delete cascade,
    operator_id uuid not null references public.user_profile(id) on delete cascade,
    action text not null check (action in ('open','renew','cancel')),
    days integer not null default 0,
    note text,
    created_at timestamptz not null default now()
);
create index if not exists idx_vip_log_user on public.vip_log(user_id, created_at desc);

-- ============================================================================
-- 触发器 1：新用户注册时自动创建 user_profile
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.user_profile (id, email, nickname)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ============================================================================
-- 触发器 2：posts.comment_count 自动维护
-- ============================================================================
-- 关键：必须 SECURITY DEFINER，否则评论者不是帖子作者时
-- RLS 会阻止 UPDATE posts.comment_count，导致计数不同步
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

-- ============================================================================
-- 触发器 3：user_profile.post_count 自动维护
-- ============================================================================
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

-- ============================================================================
-- 触发器 4：posts.updated_at 自动更新
-- ============================================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
    before update on public.posts
    for each row execute function public.update_updated_at();

-- ============================================================================
-- RLS 行级安全策略
-- ============================================================================
alter table public.user_profile enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.report enable row level security;
alter table public.collect enable row level security;
alter table public.vip_log enable row level security;

-- ---------- 前置：创建 is_admin() 安全定义函数 ----------
-- 关键：使用 security definer 绕过 RLS，避免策略内查询 user_profile 导致无限递归
-- 所有需要检查管理员身份的策略均调用此函数，而非子查询 user_profile
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.user_profile where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- ---- user_profile 策略 ----
-- 读取：本人或管理员可读（公开字段通过 API 中转脱敏，不直接暴露）
drop policy if exists "profile_read_self_or_admin" on public.user_profile;
create policy "profile_read_self_or_admin" on public.user_profile
    for select using (
        auth.uid() = id
        or public.is_admin()
    );
-- 修改：仅本人可改自己资料
drop policy if exists "profile_update_self" on public.user_profile;
create policy "profile_update_self" on public.user_profile
    for update using (auth.uid() = id);

-- ---- posts 策略 ----
-- 读取：所有正常帖可读，作者可读自己全部帖，管理员可读全部
drop policy if exists "posts_read_normal" on public.posts;
create policy "posts_read_normal" on public.posts
    for select using (
        status = 'normal'
        or author_id = auth.uid()
        or public.is_admin()
    );
-- 插入：登录用户只能为自己发帖
drop policy if exists "posts_insert_auth" on public.posts;
create policy "posts_insert_auth" on public.posts
    for insert with check (author_id = auth.uid());
-- 修改：作者或管理员
drop policy if exists "posts_update_owner_admin" on public.posts;
create policy "posts_update_owner_admin" on public.posts
    for update using (
        author_id = auth.uid()
        or public.is_admin()
    );
-- 删除：作者或管理员
drop policy if exists "posts_delete_owner_admin" on public.posts;
create policy "posts_delete_owner_admin" on public.posts
    for delete using (
        author_id = auth.uid()
        or public.is_admin()
    );

-- ---- comments 策略 ----
-- 读取：所有人可读（公开评论）
drop policy if exists "comments_read_all" on public.comments;
create policy "comments_read_all" on public.comments
    for select using (true);
-- 插入：登录用户只能为自己发评论
drop policy if exists "comments_insert_auth" on public.comments;
create policy "comments_insert_auth" on public.comments
    for insert with check (user_id = auth.uid());
-- 删除：作者或管理员
drop policy if exists "comments_delete_owner_admin" on public.comments;
create policy "comments_delete_owner_admin" on public.comments
    for delete using (
        user_id = auth.uid()
        or public.is_admin()
    );

-- ---- report 策略 ----
-- 读取：举报人或管理员
drop policy if exists "report_read_self_admin" on public.report;
create policy "report_read_self_admin" on public.report
    for select using (
        reporter_id = auth.uid()
        or public.is_admin()
    );
-- 插入：登录用户只能为自己提交举报
drop policy if exists "report_insert_auth" on public.report;
create policy "report_insert_auth" on public.report
    for insert with check (reporter_id = auth.uid());
-- 修改：仅管理员
drop policy if exists "report_update_admin" on public.report;
create policy "report_update_admin" on public.report
    for update using (public.is_admin());

-- ---- collect 策略 ----
-- 仅本人可读写自己的收藏
drop policy if exists "collect_owner_all" on public.collect;
create policy "collect_owner_all" on public.collect
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- vip_log 策略 ----
-- 读取：本人或管理员
drop policy if exists "vip_log_read" on public.vip_log;
create policy "vip_log_read" on public.vip_log
    for select using (
        user_id = auth.uid()
        or operator_id = auth.uid()
        or public.is_admin()
    );
-- 插入：仅管理员（通过 service_role 绕过 RLS，仍保留策略兜底）
drop policy if exists "vip_log_insert_admin" on public.vip_log;
create policy "vip_log_insert_admin" on public.vip_log
    for insert with check (
        public.is_admin()
        or operator_id = auth.uid()
    );

-- ============================================================================
-- Storage 桶：covers（帖子封面图，公开可读）
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- Storage 策略
drop policy if exists "covers_read_public" on storage.objects;
create policy "covers_read_public" on storage.objects
    for select using (bucket_id = 'covers');

drop policy if exists "covers_upload_auth" on storage.objects;
create policy "covers_upload_auth" on storage.objects
    for insert with check (bucket_id = 'covers' and auth.role() = 'authenticated');

drop policy if exists "covers_delete_owner" on storage.objects;
create policy "covers_delete_owner" on storage.objects
    for delete using (bucket_id = 'covers' and owner = auth.uid());

-- ============================================================================
-- 初始化首个管理员（手动执行）
-- ============================================================================
-- 部署完成后，先用前端注册一个管理员账号，
-- 然后在 SQL Editor 执行以下语句（替换邮箱）将该用户置为管理员：
--
-- update public.user_profile
-- set is_admin = true
-- where email = 'your-admin@example.com';
-- ============================================================================

-- 脚本执行完毕
