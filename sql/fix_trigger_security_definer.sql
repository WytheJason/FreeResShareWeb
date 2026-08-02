-- ============================================================
-- 触发器函数 SECURITY DEFINER 修复脚本
-- 问题：update_comment_count() 和 update_post_count() 未标记
--   SECURITY DEFINER，导致评论者不是帖子作者时
--   RLS 阻止 UPDATE posts.comment_count，计数不同步
-- 修复：添加 SECURITY DEFINER + set search_path
-- 执行位置：Supabase 后台 SQL Editor
-- ============================================================

-- ---------- 1. 修复 update_comment_count ----------
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

-- 重新绑定触发器（函数签名变了需要重建）
drop trigger if exists trg_comments_count on public.comments;
create trigger trg_comments_count
    after insert or delete on public.comments
    for each row execute function public.update_comment_count();

-- ---------- 2. 修复 update_post_count ----------
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

-- 重新绑定触发器
drop trigger if exists trg_posts_count on public.posts;
create trigger trg_posts_count
    after insert or delete on public.posts
    for each row execute function public.update_post_count();

-- ---------- 完成提示 ----------
-- 验证：执行以下语句确认函数已更新
-- select proname, prosecdef from pg_proc where proname in ('update_comment_count', 'update_post_count');
-- prosecdef = true 表示 SECURITY DEFINER 已生效
