/**
 * 编辑帖子接口
 * - 必须登录
 * - 必须是作者或管理员
 * - sanitizeUserContent 清理
 * - 校验网盘链接格式
 */
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  sanitizeUserContent,
  isValidPanUrl,
  containsMaliciousLink,
} from '@/lib/security';
import { successResponse, errorResponse, HTTP_STATUS, isValidPanCode } from '@/lib/utils';
import type { PostCategory, PanType, PostStatus } from '@/lib/types';

// 合法白名单
const CATEGORY_SET: PostCategory[] = ['software', 'movie'];
const PAN_TYPE_SET: PanType[] = ['baidu', 'aliyun', 'quark'];
const STATUS_SET: PostStatus[] = ['normal', 'pending', 'hidden'];

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      cover_url,
      category,
      pan_type,
      pan_url,
      pan_code,
      is_vip,
      status,
      is_top,
    } = body as {
      id: string;
      title?: string;
      description?: string;
      cover_url?: string;
      category?: PostCategory;
      pan_type?: PanType;
      pan_url?: string;
      pan_code?: string;
      is_vip?: boolean;
      status?: PostStatus;
      is_top?: boolean;
    };

    // ---------- 1. 登录校验 ----------
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(errorResponse('未登录', 401), {
        status: HTTP_STATUS.UNAUTHORIZED,
      });
    }
    if (!id) {
      return NextResponse.json(errorResponse('缺少帖子 id', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    const supabase = await getSupabaseServer();

    // ---------- 2. 查询帖子并校验权限 ----------
    const { data: post, error: queryError } = await supabase
      .from('posts')
      .select('id, author_id, pan_type')
      .eq('id', id)
      .single();

    if (queryError || !post) {
      return NextResponse.json(errorResponse('帖子不存在', 404), {
        status: HTTP_STATUS.NOT_FOUND,
      });
    }

    const isAuthor = post.author_id === user.id;
    if (!isAuthor && !isAdmin(user)) {
      return NextResponse.json(errorResponse('无权编辑该帖子', 403), {
        status: HTTP_STATUS.FORBIDDEN,
      });
    }

    // ---------- 3. 字段校验 ----------
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      const safeTitle = title.trim();
      if (!safeTitle || safeTitle.length > 100) {
        return NextResponse.json(errorResponse('标题长度需在 1-100 之间', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      updateData.title = sanitizeUserContent(safeTitle);
    }

    if (description !== undefined) {
      if (description.length > 2000) {
        return NextResponse.json(errorResponse('简介最多 2000 字', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      const safeDesc = sanitizeUserContent(description);
      if (containsMaliciousLink(safeDesc)) {
        return NextResponse.json(errorResponse('简介包含非法外链', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      updateData.description = safeDesc;
    }

    if (cover_url !== undefined) {
      updateData.cover_url = cover_url.trim();
    }

    if (category !== undefined) {
      if (!CATEGORY_SET.includes(category)) {
        return NextResponse.json(errorResponse('分类不合法', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      updateData.category = category;
    }

    if (pan_type !== undefined) {
      if (!PAN_TYPE_SET.includes(pan_type)) {
        return NextResponse.json(errorResponse('网盘类型不合法', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      updateData.pan_type = pan_type;
    }

    if (pan_url !== undefined) {
      // 同时校验与现有 pan_type 或新 pan_type 匹配
      const finalType = (pan_type ?? post.pan_type) as PanType;
      if (!isValidPanUrl(finalType, pan_url)) {
        return NextResponse.json(errorResponse('网盘链接格式不正确', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      updateData.pan_url = pan_url.trim();
    }

    if (pan_code !== undefined) {
      if (!isValidPanCode(pan_code)) {
        return NextResponse.json(errorResponse('提取码格式不正确', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      updateData.pan_code = pan_code.trim();
    }

    if (is_vip !== undefined) {
      updateData.is_vip = !!is_vip;
    }

    // 状态变更：仅管理员可设置
    if (status !== undefined) {
      if (!isAdmin(user)) {
        return NextResponse.json(errorResponse('无权修改帖子状态', 403), {
          status: HTTP_STATUS.FORBIDDEN,
        });
      }
      if (!STATUS_SET.includes(status)) {
        return NextResponse.json(errorResponse('帖子状态不合法', 1), {
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }
      updateData.status = status;
    }

    // 置顶变更：仅管理员可设置
    if (is_top !== undefined) {
      if (!isAdmin(user)) {
        return NextResponse.json(errorResponse('无权修改置顶状态', 403), {
          status: HTTP_STATUS.FORBIDDEN,
        });
      }
      updateData.is_top = !!is_top;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(errorResponse('没有需要更新的字段', 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    // ---------- 4. 执行更新 ----------
    const { error: updateError } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(errorResponse(updateError.message, 1), {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    }

    return NextResponse.json(successResponse(null, '更新成功'), {
      status: HTTP_STATUS.OK,
    });
  } catch (error) {
    console.error('[Post Update] 异常', error);
    return NextResponse.json(errorResponse('服务器异常', 500), {
      status: HTTP_STATUS.INTERNAL_ERROR,
    });
  }
}
