'use client';

/**
 * 发布资源页（客户端组件）
 * - 表单字段：title / description / category / pan_links / cover_url / is_vip
 * - 支持同时添加多个网盘链接（百度/阿里/夸克）
 * - 顶部违规警示框
 * - 封面图上传（Supabase Storage）+ 预览 + 使用默认封面
 * - VIP 加密开关
 * - 底部极验验证 + 发布按钮
 * - 提交后跳转 /post/[id]
 */
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  X,
  Crown,
  Image as ImageIcon,
  AlertTriangle,
  Coins,
  Plus,
  Trash2,
  Lock,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase';
import { isValidPanCode } from '@/lib/utils';
import type {
  PostCategory,
  PanType,
  PanLink,
  PostForm,
  UserProfile,
} from '@/lib/types';
import { CATEGORY_LABELS, PAN_TYPE_LABELS } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { Spinner } from '@/components/Loading';
import TurnstileWidget, { type TurnstileWidgetHandle } from '@/components/TurnstileWidget';

// 网盘类型对应的合法域名（前端简单校验，后端会再做严格校验）
const PAN_DOMAINS: Record<PanType, string[]> = {
  baidu: ['pan.baidu.com'],
  aliyun: ['alipan.com', 'aliyundrive.com'],
  quark: ['pan.quark.cn'],
};

/**
 * 校验网盘链接是否包含对应域名（前端粗校验）
 */
function isPanUrlLikelyValid(panType: PanType, url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  return PAN_DOMAINS[panType].some((d) => lower.includes(d));
}

export default function PublishPage() {
  const router = useRouter();
  const toast = useToast();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 表单状态
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PostCategory>('software');
  // 多网盘链接列表（至少 1 条，最多 5 条）
  const [panLinks, setPanLinks] = useState<PanLink[]>([
    { type: 'baidu', url: '', code: '' },
  ]);
  const [coverUrl, setCoverUrl] = useState('');
  const [isVip, setIsVip] = useState(false);
  const [needLogin, setNeedLogin] = useState(true);
  const [pointsCost, setPointsCost] = useState(0);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const MAX_LINKS = 5;

  // 添加一个网盘链接
  function addPanLink() {
    if (panLinks.length >= MAX_LINKS) return;
    setPanLinks([...panLinks, { type: 'baidu', url: '', code: '' }]);
  }

  // 删除指定索引的网盘链接
  function removePanLink(index: number) {
    if (panLinks.length <= 1) return;
    setPanLinks(panLinks.filter((_, i) => i !== index));
  }

  // 更新指定索引的网盘链接
  function updatePanLink(index: number, field: keyof PanLink, value: string) {
    setPanLinks(
      panLinks.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      )
    );
  }

  // 获取当前登录用户（用于封面上传路径与 VIP 提示）
  // 未登录时自动跳转到登录页
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        // 未登录，跳转到登录页，登录后回到发布页
        router.replace('/login?redirect=/publish');
        return;
      }
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      setUser({
        id: data.user.id,
        email: data.user.email ?? '',
        nickname: (meta.nickname as string) ?? '',
        avatar: (meta.avatar as string) ?? '',
        bio: (meta.bio as string) ?? '',
        is_admin: Boolean(meta.is_admin),
        is_vip: Boolean(meta.is_vip),
        vip_started_at: (meta.vip_started_at as string) ?? null,
        vip_expired_at: (meta.vip_expired_at as string) ?? null,
        is_banned: Boolean(meta.is_banned),
        post_count: Number(meta.post_count ?? 0),
        comment_count: Number(meta.comment_count ?? 0),
        created_at: (meta.created_at as string) ?? '',
        // 积分相关字段（user_metadata 通常不含，发布页主要用 id/nickname/is_vip）
        points: Number(meta.points ?? 0),
        total_earned_points: Number(meta.total_earned_points ?? 0),
        invite_code: (meta.invite_code as string) ?? null,
        invited_by: (meta.invited_by as string) ?? null,
        invite_count: Number(meta.invite_count ?? 0),
      });
      setChecking(false);
    });
  }, [router]);

  // 登录校验中显示加载状态，避免未登录用户看到表单
  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // ============ 封面图上传 ============
  async function handleCoverUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) {
      toast.show('error', '请先登录');
      return;
    }

    // 简单大小校验（5MB 上限）
    if (file.size > 5 * 1024 * 1024) {
      toast.show('error', '封面图片不能超过 5MB');
      return;
    }

    const supabase = getSupabaseBrowser();
    // 路径：covers/{userId}/{timestamp}-{filename}
    // 文件名做简单清洗（去除空格与特殊字符）
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `covers/${user.id}/${Date.now()}-${safeName}`;

    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from('covers')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });
      if (error) {
        toast.show('error', '封面上传失败：' + error.message);
        return;
      }
      const { data } = supabase.storage.from('covers').getPublicUrl(path);
      setCoverUrl(data.publicUrl);
      toast.show('success', '封面已上传');
    } catch {
      toast.show('error', '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  }

  function handleUseDefaultCover() {
    setCoverUrl('');
    toast.show('info', '已切换为默认封面');
  }

  // ============ 表单提交 ============
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // 1. 字段校验
    const safeTitle = title.trim();
    if (!safeTitle) {
      toast.show('error', '请填写标题');
      return;
    }
    if (safeTitle.length > 100) {
      toast.show('error', '标题最多 100 字');
      return;
    }
    if (description.length > 2000) {
      toast.show('error', '简介最多 2000 字');
      return;
    }

    // 校验多网盘链接：至少 1 条有效链接
    const validLinks: PanLink[] = [];
    for (let i = 0; i < panLinks.length; i++) {
      const link = panLinks[i];
      const url = link.url.trim();
      const code = link.code.trim();
      if (!url) {
        toast.show('error', `第 ${i + 1} 条网盘链接不能为空`);
        return;
      }
      if (!isPanUrlLikelyValid(link.type, url)) {
        toast.show('error', `第 ${i + 1} 条链接格式不正确，请确认是${PAN_TYPE_LABELS[link.type]}的链接`);
        return;
      }
      if (!isValidPanCode(code)) {
        toast.show('error', `第 ${i + 1} 条链接的提取码格式不正确（0-8 位字母数字）`);
        return;
      }
      validLinks.push({ type: link.type, url, code });
    }

    if (validLinks.length === 0) {
      toast.show('error', '请至少填写一条网盘链接');
      return;
    }

    // 2. 构造表单数据
    // pan_type/pan_url/pan_code 取第一条链接（向后兼容旧逻辑）
    const firstLink = validLinks[0];
    const form: PostForm = {
      title: safeTitle,
      description: description.trim(),
      cover_url: coverUrl.trim(),
      category,
      pan_type: firstLink.type,
      pan_url: firstLink.url,
      pan_code: firstLink.code,
      pan_links: validLinks,
      is_vip: isVip,
      need_login: needLogin,
      points_cost: Math.max(0, Math.min(100, Number(pointsCost) || 0)),
    };

    setLoading(true);
    try {
      const token = await turnstileRef.current?.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/post/create', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, captcha: { type: 'turnstile', token } }),
      });

      // 401 表示服务端会话已失效（access_token 过期且 refresh 失败）
      if (res.status === 401) {
        toast.show('error', '登录状态已失效，请重新登录');
        turnstileRef.current?.reset();
        router.push('/login?redirect=/publish');
        return;
      }

      const data = await res.json();
      if (data.code === 0 && data.data?.id) {
        toast.show('success', '发布成功');
        // 先刷新服务端组件（清空 Next 路由器的服务端渲染缓存）
        router.refresh();
        // 小延迟后跳转到详情页，确保 refresh 生效
        setTimeout(() => {
          router.push(`/post/${data.data.id}`);
          // 跳转后再次刷新，双重保险
          setTimeout(() => router.refresh(), 80);
        }, 80);
      } else {
        toast.show('error', data.message || '发布失败');
        turnstileRef.current?.reset();
      }
    } catch {
      toast.show('error', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* 返回首页 */}
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-primary-300"
      >
        <ArrowLeft size={12} />
        返回首页
      </Link>

      <div className="card overflow-hidden">
        {/* 标题栏 */}
        <div className="border-b border-border bg-bg-elevated/50 px-6 py-4">
          <h1 className="text-lg font-bold text-text-primary">发布资源</h1>
          <p className="mt-1 text-xs text-text-muted">
            分享优质网盘资源，共建社区生态
          </p>
        </div>

        {/* 违规警示 */}
        <div className="m-6 mb-0 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">违规资源警示</p>
            <p className="mt-1 text-xs leading-5">
              禁止发布违法、色情、侵权内容，违规将封号处理。
              请确认所分享资源来自合法渠道并拥有分享权限。
            </p>
          </div>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* 标题 */}
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              标题 <span className="text-danger">*</span>
              <span className="ml-1 text-text-dim">（1-100 字）</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="一句话概括资源内容"
              className="input-field"
              required
            />
          </div>

          {/* 简介 */}
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              简介
              <span className="ml-1 text-text-dim">
                （选填，0-2000 字，{description.length}/2000）
              </span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="资源详细介绍、版本信息、使用说明等"
              className="input-field resize-y"
            />
          </div>

          {/* 分类 */}
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              分类 <span className="text-danger">*</span>
            </label>
            <div className="flex gap-2">
              {(
                Object.entries(CATEGORY_LABELS) as [PostCategory, string][]
              ).map(([value, label]) => {
                const active = category === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                      active
                        ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                        : 'border-border bg-bg-surface text-text-secondary hover:border-primary-500/50'
                    }`}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 网盘链接（支持多条） */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs text-text-muted">
                网盘链接 <span className="text-danger">*</span>
                <span className="ml-1 text-text-dim">（最多 {MAX_LINKS} 条，至少 1 条）</span>
              </label>
              {panLinks.length < MAX_LINKS && (
                <button
                  type="button"
                  onClick={addPanLink}
                  className="inline-flex items-center gap-1 rounded-md border border-primary-500/50 px-2 py-1 text-xs text-primary-300 transition-colors hover:bg-primary-500/10"
                >
                  <Plus size={12} />
                  添加链接
                </button>
              )}
            </div>

            {/* 多链接列表 */}
            <div className="space-y-3">
              {panLinks.map((link, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-bg-surface p-3"
                >
                  {/* 链接头部：序号 + 网盘类型选择 + 删除按钮 */}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-text-secondary">
                      链接 {index + 1}
                    </span>
                    {panLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePanLink(index)}
                        className="text-text-dim transition-colors hover:text-danger"
                        aria-label="删除此链接"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* 网盘类型选择 */}
                  <div className="mb-2 grid grid-cols-3 gap-1.5">
                    {(
                      Object.entries(PAN_TYPE_LABELS) as [PanType, string][]
                    ).map(([value, label]) => {
                      const active = link.type === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updatePanLink(index, 'type', value)}
                          className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-all ${
                            active
                              ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                              : 'border-border bg-bg-elevated text-text-secondary hover:border-primary-500/50'
                          }`}
                          aria-pressed={active}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* 网盘链接输入 */}
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => updatePanLink(index, 'url', e.target.value)}
                    placeholder={`请粘贴${PAN_TYPE_LABELS[link.type]}分享链接`}
                    className="input-field mb-2"
                    required
                  />

                  {/* 提取码输入 */}
                  <input
                    type="text"
                    value={link.code}
                    onChange={(e) => updatePanLink(index, 'code', e.target.value)}
                    maxLength={8}
                    placeholder="提取码（选填，0-8 位字母数字）"
                    className="input-field mb-2"
                  />

                  {/* 规格标签输入 */}
                  <input
                    type="text"
                    value={link.label || ''}
                    onChange={(e) => updatePanLink(index, 'label', e.target.value)}
                    maxLength={20}
                    placeholder="规格/版本标签（选填，如：4K版、标准版、iOS版）"
                    className="input-field"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 封面图 */}
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              封面图
              <span className="ml-1 text-text-dim">（选填，建议 16:9）</span>
            </label>

            {/* 已上传封面预览 */}
            {coverUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt="封面预览"
                  className="aspect-video w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setCoverUrl('')}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-bg-base/80 text-text-primary transition-colors hover:bg-danger hover:text-white"
                  aria-label="移除封面"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle bg-bg-surface px-4 py-6 text-text-muted transition-colors hover:border-primary-500/50 hover:text-primary-300">
                {uploading ? (
                  <>
                    <Spinner />
                    <span className="text-xs">上传中...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon size={28} />
                    <span className="text-xs">点击上传封面图（≤ 5MB）</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}

            {/* 使用默认封面按钮 */}
            {coverUrl && (
              <button
                type="button"
                onClick={handleUseDefaultCover}
                className="mt-2 inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-primary-300"
              >
                <Upload size={10} />
                使用默认封面
              </button>
            )}
          </div>

          {/* VIP 加密开关 */}
          <div className="flex items-start justify-between rounded-lg border border-border bg-bg-surface px-4 py-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Crown size={14} className="text-gold-400" />
                <span className="text-sm font-medium text-text-primary">
                  VIP 加密
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                开启后仅 VIP 会员可查看完整网盘链接
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isVip}
              onClick={() => setIsVip((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                isVip ? 'bg-gold-500' : 'bg-border-subtle'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  isVip ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* 需要登录查看开关 */}
          <div className="flex items-start justify-between rounded-lg border border-border bg-bg-surface px-4 py-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-blue-400" />
                <span className="text-sm font-medium text-text-primary">
                  需要登录查看
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                关闭后访客无需登录即可查看资源链接，开启后需登录
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={needLogin}
              onClick={() => setNeedLogin((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                needLogin ? 'bg-blue-500' : 'bg-border-subtle'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  needLogin ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* 积分费用设置 */}
          <div className="rounded-lg border border-border bg-bg-surface px-4 py-3">
            <div className="flex items-center gap-2">
              <Coins size={14} className="text-purple-400" />
              <span className="text-sm font-medium text-text-primary">
                积分查看费用
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              设置后用户需消耗积分才能查看资源链接（0 表示免费公开）
            </p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={pointsCost}
                onChange={(e) => setPointsCost(Number(e.target.value))}
                className="flex-1 accent-purple-500"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pointsCost}
                  onChange={(e) => setPointsCost(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  className="input-field w-20 text-center"
                />
                <span className="text-xs text-text-muted">积分</span>
              </div>
            </div>
            {pointsCost > 0 && (
              <p className="mt-2 text-xs text-purple-300">
                用户查看此资源需消耗 {pointsCost} 积分，你将获得发帖奖励
              </p>
            )}
          </div>

          {/* 人机验证 */}
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              人机验证 <span className="text-danger">*</span>
            </label>
            <TurnstileWidget
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onSuccess={() => {}}
              onError={(msg) => toast.show('error', msg)}
            />
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              <>
                <Spinner />
                发布中...
              </>
            ) : (
              '立即发布'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
