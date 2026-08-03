/**
 * 发布帖子接口
 * - Turnstile 校验 + 防抖锁
 * - 校验标题/简介/分类/网盘链接/提取码
 * - 入库 posts 表
 */
import { NextResponse } from 'next/server';
import { getSupabaseServiceAdmin } from '@/lib/supabase-server';
import { getCurrentUser, canPublish } from '@/lib/auth';
import { verifyTurnstileToken, getTurnstileSecretKey } from '@/lib/turnstile';
import {
  sanitizeUserContent,
  isValidPanUrl,
  containsMaliciousLink,
  acquireSubmitLock,
  releaseSubmitLock,
  buildLockKey,
} from '@/lib/security';
import {
  successResponse,
  errorResponse,
  HTTP_STATUS,
  isValidPanCode,
} from '@/lib/utils';
import type { PostForm, PostCategory, PanType, CaptchaTicket } from '@/lib/types';
import { POINT_RULES } from '@/lib/types';

// 允许的分类与网盘类型白名单
const CATEGORY_WHITELIST: PostCategory[] = ['software', 'movie'];
const PAN_TYPE_WHITELIST: PanType[] = ['baidu', 'aliyun', 'quark'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      cover_url,
      category,
      pan_type,
      pan_url,
      pan_code,
      pan_links,
      is_vip,
      points_cost,
      captcha,
    } = body as PostForm & { captcha: CaptchaTicket };

    // ---------- 1. 登录 & 封禁校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!canPublish(user)) {
      return NextResponse.json(errorResponse('账号已被封禁，无法发布内容', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // ---------- 2. Turnstile 验证 ----------
    if (!captcha || !captcha.token) {
      return NextResponse.json(errorResponse('缺少人机验证票据', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }
    const secretKey = getTurnstileSecretKey();
    if (secretKey) {
      const verifyResult = await verifyTurnstileToken(captcha.token, secretKey);
      if (!verifyResult.success) {
        return NextResponse.json(errorResponse(`人机验证失败: ${verifyResult.error || '未知错误'}`, 403), {
          status: HTTP_STATUS.FORBIDDEN,
        });
      }
    }

    // ---------- 3. 防抖锁（5 秒）----------
    const lockKey = buildLockKey(user.id, 'post-create');
    if (!acquireSubmitLock(lockKey, 5000)) {
      return NextResponse.json(errorResponse('提交过于频繁，请稍后重试', 429), {
        status: HTTP_STATUS.TOO_MANY_REQUESTS,
      });
    }

    try {
      // ---------- 4. 参数校验 ----------
      const safeTitle = (title ?? '').trim();
      if (!safeTitle || safeTitle.length > 100) {
        return NextResponse.json(errorResponse('标题长度需在 1-100 之间', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      const descRaw = description ?? '';
      if (descRaw.length > 2000) {
        return NextResponse.json(errorResponse('简介最多 2000 字', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      if (!category || !CATEGORY_WHITELIST.includes(category)) {
        return NextResponse.json(errorResponse('分类不合法', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      // ---------- 4.1 多网盘链接校验 ----------
      // pan_links 为数组，至少 1 条，最多 5 条
      // 兼容旧逻辑：若未传 pan_links，则用 pan_type/pan_url/pan_code 构造
      let validatedLinks: Array<{ type: PanType; url: string; code: string }> = [];

      if (Array.isArray(pan_links) && pan_links.length > 0) {
        if (pan_links.length > 5) {
          return NextResponse.json(errorResponse('网盘链接最多 5 条', 1), {
            status: HTTP_STATUS.BAD_REQUEST,
          });
        }
        for (let i = 0; i < pan_links.length; i++) {
          const link = pan_links[i];
          if (!link || !PAN_TYPE_WHITELIST.includes(link.type)) {
            return NextResponse.json(errorResponse(`第 ${i + 1} 条链接网盘类型不合法`, 1), {
              status: HTTP_STATUS.BAD_REQUEST,
            });
          }
          if (!isValidPanUrl(link.type, link.url)) {
            return NextResponse.json(errorResponse(`第 ${i + 1} 条链接格式不正确`, 1), {
              status: HTTP_STATUS.BAD_REQUEST,
            });
          }
          if (!isValidPanCode(link.code ?? '')) {
            return NextResponse.json(errorResponse(`第 ${i + 1} 条链接提取码格式不正确（0-8 位字母数字）`, 1), {
              status: HTTP_STATUS.BAD_REQUEST,
            });
          }
          validatedLinks.push({
            type: link.type,
            url: link.url.trim(),
            code: (link.code ?? '').trim(),
          });
        }
      } else {
        // 兼容旧逻辑：用单个字段构造
        if (!pan_type || !PAN_TYPE_WHITELIST.includes(pan_type)) {
          return NextResponse.json(errorResponse('网盘类型不合法', 1), {
            status: HTTP_STATUS.BAD_REQUEST,
          });
        }
        if (!isValidPanUrl(pan_type, pan_url)) {
          return NextResponse.json(errorResponse('网盘链接格式不正确', 1), {
            status: HTTP_STATUS.BAD_REQUEST,
          });
        }
        if (!isValidPanCode(pan_code ?? '')) {
          return NextResponse.json(errorResponse('提取码格式不正确（0-8 位字母数字）', 1), {
            status: HTTP_STATUS.BAD_REQUEST,
          });
        }
        validatedLinks.push({
          type: pan_type,
          url: pan_url.trim(),
          code: (pan_code ?? '').trim(),
        });
      }

      // 取第一条作为主链接（pan_type/pan_url/pan_code 向后兼容）
      const primaryLink = validatedLinks[0];

      // ---------- 5. 内容安全处理 ----------
      const safeDescription = sanitizeUserContent(descRaw);
      if (containsMaliciousLink(safeDescription)) {
        return NextResponse.json(errorResponse('简介包含非法外链', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      // ---------- 6. 入库 ----------
      // 使用 service_role 绕过 RLS，确保 insert 不被 RLS 阻止
      // 用户身份已通过 getCurrentUser() 验证，author_id 手动设置为当前用户
      const admin = getSupabaseServiceAdmin();
      // 积分费用校验：范围 0-100，非数字或负数默认 0
      const safePointsCost = Math.max(0, Math.min(100, Number(points_cost) || 0));

      const { data, error } = await admin
        .from('posts')
        .insert({
          title: safeTitle,
          description: safeDescription,
          cover_url: (cover_url ?? '').trim(),
          category,
          pan_type: primaryLink.type,
          pan_url: primaryLink.url,
          pan_code: primaryLink.code,
          pan_links: validatedLinks,
          is_vip: !!is_vip,
          points_cost: safePointsCost,
          author_id: user.id,
          status: 'normal',
        })
        .select('id')
        .single();

      if (error) {
        return NextResponse.json(errorResponse(error.message, 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      // ---------- 7. 发帖奖励积分 ----------
      try {
        await admin.rpc('change_user_points', {
          p_user_id: user.id,
          p_amount: POINT_RULES.POST_REWARD,
          p_action: 'post_reward',
          p_post_id: data.id,
          p_note: `发帖奖励: ${safeTitle.slice(0, 20)}`,
        });
      } catch (e) {
        console.warn('[Post Create] 发帖奖励发放失败:', (e as Error).message);
      }

      // post_count 由数据库触发器 trg_posts_count 自动维护，无需手动更新

      return NextResponse.json(
        successResponse({ id: data.id }, '发布成功'),
        { status: HTTP_STATUS.OK }
      );
    } finally {
      // 业务结束释放锁（无论成功失败）
      releaseSubmitLock(lockKey);
    }
  } catch (error) {
    console.error('[Post Create] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
