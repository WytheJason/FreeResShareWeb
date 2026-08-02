-- ============================================================
-- 存储桶：avatars（用户头像，公开可读）
-- ------------------------------------------------------------
-- 用途：个人中心「编辑资料」支持本地上传头像
-- 执行方式：Supabase Dashboard > SQL Editor > 粘贴本文件 > Run
-- 幂等：可重复执行，已存在则跳过
-- ============================================================

-- 1. 创建公开存储桶
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2. RLS 策略
-- 2.1 公开读取（头像需要全站可见）
drop policy if exists "avatars_read_public" on storage.objects;
create policy "avatars_read_public" on storage.objects
    for select using (bucket_id = 'avatars');

-- 2.2 已登录用户可上传（写入自己的头像目录，由前端按 {userId}/ 路径规范）
drop policy if exists "avatars_upload_auth" on storage.objects;
create policy "avatars_upload_auth" on storage.objects
    for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- 2.3 仅上传者本人可删除（覆盖更新时清理旧头像）
drop policy if exists "avatars_delete_owner" on storage.objects;
create policy "avatars_delete_owner" on storage.objects
    for delete using (bucket_id = 'avatars' and owner = auth.uid());

-- 2.4 允许上传者更新（upsert 场景）
drop policy if exists "avatars_update_owner" on storage.objects;
create policy "avatars_update_owner" on storage.objects
    for update using (bucket_id = 'avatars' and owner = auth.uid());
