/**
 * 全局 TypeScript 类型定义
 * 所有业务模型集中声明，禁止 any
 */

// ============ 用户角色 ============
export type UserRole = 'guest' | 'user' | 'vip' | 'admin';

// ============ 积分变动类型 ============
export type PointAction =
  | 'register'        // 注册奖励
  | 'invite_reward'   // 邀请好友奖励
  | 'invited_bonus'   // 被邀请奖励
  | 'post_reward'     // 发帖奖励
  | 'comment_reward'  // 评论奖励
  | 'unlock_post'     // 解锁资源消费
  | 'admin_adjust';   // 管理员调整

// ============ 积分规则常量 ============
export const POINT_RULES = {
  /** 注册奖励积分 */
  REGISTER_REWARD: 10,
  /** 邀请好友奖励积分（邀请人获得） */
  INVITE_REWARD: 20,
  /** 被邀请奖励积分（新用户额外获得） */
  INVITED_BONUS: 5,
  /** 发帖奖励积分 */
  POST_REWARD: 2,
  /** 评论奖励积分 */
  COMMENT_REWARD: 1,
} as const;

// ============ 积分变动类型标签映射 ============
export const POINT_ACTION_LABELS: Record<PointAction, string> = {
  register: '注册奖励',
  invite_reward: '邀请好友奖励',
  invited_bonus: '被邀请奖励',
  post_reward: '发帖奖励',
  comment_reward: '评论奖励',
  unlock_post: '解锁资源消费',
  admin_adjust: '管理员调整',
};

// ============ 帖子分类 ============
export type PostCategory = 'software' | 'movie';

// ============ 网盘类型 ============
export type PanType = 'baidu' | 'aliyun' | 'quark';

// ============ 帖子状态 ============
export type PostStatus = 'normal' | 'pending' | 'hidden';

// ============ 举报状态 ============
export type ReportStatus = 'pending' | 'handled' | 'archived';

// ============ VIP 操作类型 ============
export type VipAction = 'open' | 'renew' | 'cancel';

// ============ 统一 API 响应格式 ============
export interface ApiResponse<T = unknown> {
  /** 业务状态码：0 成功，非 0 失败 */
  code: number;
  /** 提示文案 */
  message: string;
  /** 业务数据 */
  data?: T;
}

// ============ 用户资料 ============
export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
  bio: string;
  is_admin: boolean;
  is_vip: boolean;
  vip_started_at: string | null;
  vip_expired_at: string | null;
  is_banned: boolean;
  post_count: number;
  comment_count: number;
  created_at: string;
  /** 当前积分余额 */
  points: number;
  /** 累计获得积分 */
  total_earned_points: number;
  /** 专属邀请码 */
  invite_code: string | null;
  /** 邀请人ID */
  invited_by: string | null;
  /** 成功邀请人数 */
  invite_count: number;
}

// ============ 帖子（列表/详情通用）============
export interface Post {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  category: PostCategory;
  pan_type: PanType;
  pan_url: string;
  pan_code: string;
  is_vip: boolean;
  is_top: boolean;
  hot_weight: number;
  status: PostStatus;
  view_count: number;
  comment_count: number;
  author_id: string;
  author_nickname: string;
  author_avatar: string;
  created_at: string;
  updated_at: string;
  /** 查看资源链接所需积分（0=免费公开） */
  points_cost: number;
}

// ============ 帖子详情（带权限脱敏标记）============
export interface PostDetail extends Post {
  /** 当前用户是否有权查看完整网盘链接 */
  can_view_link: boolean;
  /** 当前用户是否有权查看提取码 */
  can_view_code: boolean;
  /** 当前用户是否已收藏 */
  is_collected: boolean;
  /** 当前用户是否为作者 */
  is_author: boolean;
  /** 脱敏后的网盘链接（无权查看时） */
  masked_pan_url?: string;
  /** 当前用户是否已用积分解锁此资源 */
  is_unlocked: boolean;
}

// ============ 评论（楼中楼）============
export interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  reply_to_id: string | null;
  reply_to_nickname: string | null;
  content: string;
  user_id: string;
  user_nickname: string;
  user_avatar: string;
  /** 子评论（嵌套结构） */
  children?: Comment[];
  created_at: string;
}

// ============ 举报 ============
export interface Report {
  id: string;
  post_id: string;
  post_title: string;
  reporter_id: string;
  reporter_nickname: string;
  reason: string;
  status: ReportStatus;
  handle_note: string | null;
  created_at: string;
  handled_at: string | null;
}

// ============ 收藏 ============
export interface Collect {
  id: string;
  user_id: string;
  post_id: string;
  post_title: string;
  post_cover_url: string;
  post_category: PostCategory;
  created_at: string;
}

// ============ VIP 操作日志 ============
export interface VipLog {
  id: string;
  user_id: string;
  operator_id: string;
  operator_nickname: string;
  action: VipAction;
  days: number;
  note: string | null;
  created_at: string;
}

// ============ 后台数据统计 ============
export interface AdminStats {
  total_users: number;
  total_posts: number;
  total_comments: number;
  total_vip: number;
  today_new_users: number;
  today_new_posts: number;
  today_new_comments: number;
  pending_reports: number;
}

// ============ Turnstile 验证参数 ============
export interface CaptchaTicket {
  type: 'turnstile';
  token: string;
}

// ============ 分页参数 ============
export interface PageQuery {
  page: number;
  page_size: number;
}

// ============ 分页结果 ============
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============ 帖子列表查询参数 ============
export interface PostListQuery extends PageQuery {
  category?: PostCategory;
  keyword?: string;
  sort?: 'latest' | 'hot' | 'top';
  is_vip?: boolean;
}

// ============ 评论列表查询参数 ============
export interface CommentListQuery extends PageQuery {
  post_id: string;
}

// ============ 发帖表单 ============
export interface PostForm {
  title: string;
  description: string;
  cover_url: string;
  category: PostCategory;
  pan_type: PanType;
  pan_url: string;
  pan_code: string;
  is_vip: boolean;
  /** 查看资源所需积分（0=免费），范围 0-100 */
  points_cost: number;
}

// ============ 网盘类型标签映射 ============
export const PAN_TYPE_LABELS: Record<PanType, string> = {
  baidu: '百度网盘',
  aliyun: '阿里云盘',
  quark: '夸克网盘',
};

// ============ 帖子分类标签映射 ============
export const CATEGORY_LABELS: Record<PostCategory, string> = {
  software: '软件工具',
  movie: '影视剧集',
};

// ============ 举报状态标签映射 ============
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '待处理',
  handled: '已处理',
  archived: '已归档',
};

// ============ VIP 操作标签映射 ============
export const VIP_ACTION_LABELS: Record<VipAction, string> = {
  open: '开通',
  renew: '续费',
  cancel: '取消',
};

// ============ 积分流水记录 ============
export interface PointLog {
  id: string;
  user_id: string;
  /** 变动金额（正=获得，负=消费） */
  change_amount: number;
  /** 变动后余额 */
  balance_after: number;
  action: PointAction;
  post_id: string | null;
  related_user_id: string | null;
  note: string | null;
  created_at: string;
}

// ============ 邀请关系记录 ============
export interface InviteRelation {
  id: string;
  inviter_id: string;
  invitee_id: string;
  invite_code: string;
  reward_points: number;
  status: 'success' | 'revoked';
  created_at: string;
  /** 被邀请人昵称（联表查询） */
  invitee_nickname?: string;
  /** 被邀请人头像 */
  invitee_avatar?: string;
}

// ============ 邀请信息汇总 ============
export interface InviteInfo {
  /** 当前用户邀请码 */
  invite_code: string;
  /** 邀请链接 */
  invite_url: string;
  /** 成功邀请人数 */
  invite_count: number;
  /** 邀请获得的总积分 */
  total_invite_points: number;
  /** 最近邀请记录 */
  recent_invites: InviteRelation[];
}

// ============ 用户统计数据（含积分）============
export interface UserStats {
  post_count: number;
  comment_count: number;
  collect_count: number;
  view_count: number;
  /** 当前积分余额 */
  points: number;
  /** 成功邀请人数 */
  invite_count: number;
}
