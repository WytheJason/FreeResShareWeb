-- ============================================================
-- RLS 无限递归修复脚本
-- 问题：user_profile 表的 RLS 策略中使用了
--   exists (select 1 from public.user_profile p where ...)
--   导致策略自身递归调用自身，引发 infinite recursion
-- 修复：创建 security definer 函数 is_admin() 绕过 RLS
-- 执行位置：Supabase 后台 SQL Editor
-- ============================================================

-- ---------- 1. 创建 is_admin() 安全定义函数 ----------
-- 此函数以表所有者权限运行（security definer），绕过 RLS
-- 用于在所有 RLS 策略中安全检查管理员身份
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.user_profile where id = auth.uid()), false);
$$;

-- 授予所有人执行权限（函数本身以 definer 权限运行）
grant execute on function public.is_admin() to authenticated, anon;

-- ---------- 2. 重写 user_profile 自身策略（修复递归根因） ----------
-- 读取：本人或管理员
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

-- ---------- 3. 重写 posts 策略 ----------
-- 读取：正常帖 + 作者本人 + 管理员
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

-- ---------- 4. 重写 comments 策略 ----------
-- 读取：所有人可读
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

-- ---------- 5. 重写 report 策略 ----------
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

-- ---------- 6. 重写 vip_log 策略 ----------
-- 读取：本人或管理员
drop policy if exists "vip_log_read" on public.vip_log;
create policy "vip_log_read" on public.vip_log
    for select using (
        user_id = auth.uid()
        or operator_id = auth.uid()
        or public.is_admin()
    );

-- 插入：仅管理员或操作人
drop policy if exists "vip_log_insert_admin" on public.vip_log;
create policy "vip_log_insert_admin" on public.vip_log
    for insert with check (
        public.is_admin()
        or operator_id = auth.uid()
    );

-- ---------- 7. 补齐 increment_post_count / increment_comment_count ----------
-- API 路由中引用了这些函数，确保它们存在
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

-- ---------- 完成提示 ----------
-- 验证：执行以下语句确认策略已更新
-- select policyname, tablename, qual, with_check from pg_policies where tablename = 'user_profile';
