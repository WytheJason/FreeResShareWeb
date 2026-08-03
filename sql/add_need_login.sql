-- ============================================================
-- 需要登录查看功能数据库迁移脚本
-- 执行位置：Supabase Dashboard > SQL Editor
-- 说明：在 posts 表新增 need_login 布尔字段，控制资源是否需要登录才能查看
-- ============================================================

-- ---------- 1. 新增 need_login 字段 ----------
-- 默认 true（需要登录），设为 false 表示公开资源（任何人可查看）
alter table public.posts
  add column if not exists need_login boolean not null default true;

comment on column public.posts.need_login is '是否需要登录才能查看，默认 true（需登录），false=公开资源';

-- ---------- 2. 添加索引（加速按 need_login 筛选）----------
create index if not exists idx_posts_need_login
  on public.posts(need_login)
  where need_login = false;

-- ---------- 3. 验证 ----------
-- select id, title, need_login from posts limit 5;
