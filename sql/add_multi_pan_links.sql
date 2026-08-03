-- ============================================================
-- 多网盘链接功能数据库迁移脚本
-- 执行位置：Supabase Dashboard > SQL Editor
-- 说明：在 posts 表新增 pan_links JSONB 字段，支持一帖多链接
-- ============================================================

-- ---------- 1. 新增 pan_links 字段 ----------
-- 存储 JSON 数组：[{ "type": "baidu", "url": "...", "code": "..." }, ...]
-- 旧帖子该字段为 null，前端自动回退到 pan_type/pan_url/pan_code
alter table public.posts
  add column if not exists pan_links jsonb;

comment on column public.posts.pan_links is '多网盘链接列表 JSON 数组，null 表示旧帖仅有单个链接';

-- ---------- 2. 为已有帖子迁移数据 ----------
-- 将旧帖子的 pan_type/pan_url/pan_code 转换为 pan_links 数组
update public.posts
set pan_links = jsonb_build_array(
  jsonb_build_object(
    'type', pan_type,
    'url', pan_url,
    'code', pan_code
  )
)
where pan_links is null;

-- ---------- 3. 验证 ----------
-- select id, pan_type, pan_links from posts limit 5;
