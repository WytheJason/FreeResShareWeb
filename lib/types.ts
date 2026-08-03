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
  | 'admin_adjust'    // 管理员调整
  | 'withdraw'        // 积分兑现消费
  | 'withdraw_refund'; // 兑现拒绝退款

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
  withdraw: '积分兑现',
  withdraw_refund: '兑现退款',
};

// ============ 积分兑现档位 ============
export interface WithdrawTier {
  points: number;
  amount: number;
  label: string;
}

export const WITHDRAW_TIERS: WithdrawTier[] = [
  { points: 2000, amount: 1, label: '2000 积分 → 1 元' },
  { points: 5000, amount: 2, label: '5000 积分 → 2 元' },
  { points: 10000, amount: 5, label: '10000 积分 → 5 元' },
];

// ============ 积分兑现记录 ============
export type WithdrawStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface WithdrawRecord {
  id: string;
  user_id: string;
  points_cost: number;
  amount: number;
  payment_method: 'alipay' | 'wxpay';
  payment_account: string;
  payment_name: string;
  status: WithdrawStatus;
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const WITHDRAW_STATUS_LABELS: Record<WithdrawStatus, string> = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已拒绝',
  paid: '已打款',
};

// ============ 帖子分类 ============
export type PostCategory = 'software' | 'movie';

// ============ 网盘类型 ============
export type PanType = 'baidu' | 'aliyun' | 'quark';

// ============ 单个网盘链接 ============
export interface PanLink {
  /** 网盘类型 */
  type: PanType;
  /** 网盘链接 */
  url: string;
  /** 提取码（可为空） */
  code: string;
  /** 规格/版本标签（如：4K版、标准版、iOS版等） */
  label?: string;
}

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
  /** 多网盘链接列表（详情页加载，列表页可能不加载） */
  pan_links?: PanLink[] | null;
  is_vip: boolean;
  /** 是否需要登录才能查看（undefined/true=需登录，false=任何人可查看） */
  need_login?: boolean;
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
  /** 脱敏后的多链接列表（无权查看时） */
  masked_pan_links?: PanLink[];
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
  /** 多网盘链接列表（发布时提交） */
  pan_links: PanLink[];
  is_vip: boolean;
  /** 是否需要登录才能查看（undefined 或 true = 需登录，false = 任何人可查看） */
  need_login?: boolean;
  /** 查看资源所需积分（0=免费），范围 0-100 */
  points_cost: number;
}

// ============ 网盘类型标签映射 ============
export const PAN_TYPE_LABELS: Record<PanType, string> = {
  baidu: '百度网盘',
  aliyun: '阿里云盘',
  quark: '夸克网盘',
};

// ============ 网盘类型图标路径 ============
export const PAN_TYPE_ICONS: Record<PanType, string> = {
  baidu: '/icons/pan-baidu.svg',
  aliyun: '/icons/pan-aliyun.svg',
  quark: '/icons/pan-quark.svg',
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

// ============ VIP 套餐 ============

/** 套餐类型 */
export type VipPlanType = 'limited' | 'permanent';

/** 套餐ID */
export type VipPlanId = 'month' | 'quarter' | 'year' | 'permanent';

/** VIP 套餐定义 */
export interface VipPlan {
  id: VipPlanId;
  /** 套餐名称 */
  name: string;
  /** 价格（元） */
  price: number;
  /** VIP 天数（null 表示永久） */
  days: number | null;
  /** 套餐类型 */
  type: VipPlanType;
  /** 原价（用于显示划线价，可选） */
  original_price?: number;
  /** 描述 */
  desc: string;
  /** 是否推荐 */
  highlight?: boolean;
}

/** VIP 套餐列表 */
export const VIP_PLANS: VipPlan[] = [
  {
    id: 'month',
    name: '月卡',
    price: 4.9,
    days: 30,
    type: 'limited',
    desc: '灵活开通，按月续费',
  },
  {
    id: 'quarter',
    name: '季卡',
    price: 12.9,
    days: 90,
    type: 'limited',
    original_price: 14.7,
    desc: '超值季卡，日均不到 5 分',
  },
  {
    id: 'year',
    name: '年卡',
    price: 59.9,
    days: 365,
    type: 'limited',
    original_price: 58.8,
    desc: '年度优选，畅享 365 天',
    highlight: true,
  },
  {
    id: 'permanent',
    name: '永久卡',
    price: 69.9,
    days: null,
    type: 'permanent',
    desc: '一次开通，终身免费',
  },
];

/** 根据 ID 获取套餐 */
export function getVipPlan(id: string): VipPlan | undefined {
  return VIP_PLANS.find((p) => p.id === id);
}

// ============ 邀请 VIP 奖励阶梯 ============

export interface InviteVipRewardTier {
  /** 需要的邀请人数 */
  required_count: number;
  /** 奖励 VIP 天数 */
  reward_days: number;
}

/** 邀请 VIP 奖励阶梯 */
export const INVITE_VIP_REWARDS: InviteVipRewardTier[] = [
  { required_count: 5, reward_days: 15 },
  { required_count: 15, reward_days: 90 },
  { required_count: 20, reward_days: 180 },
];

// ============ VIP 订单 ============

export type VipOrderStatus = 'pending' | 'paid' | 'expired' | 'failed';

/** VIP 订单 */
export interface VipOrder {
  id: string;
  /** 订单号 */
  order_no: string;
  /** 用户ID */
  user_id: string;
  /** 套餐ID */
  plan_id: VipPlanId;
  /** 套餐名称 */
  plan_name: string;
  /** 金额 */
  amount: number;
  /** VIP 天数 */
  days: number | null;
  /** 套餐类型 */
  plan_type: VipPlanType;
  /** 支付方式 */
  pay_type: string | null;
  /** 订单状态 */
  status: VipOrderStatus;
  /** 易支付交易号 */
  trade_no: string | null;
  /** 支付时间 */
  paid_at: string | null;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

// ============ 邀请 VIP 奖励记录 ============

export interface InviteVipReward {
  id: string;
  /** 用户ID */
  user_id: string;
  /** 邀请人数阶梯 */
  required_count: number;
  /** 奖励天数 */
  reward_days: number;
  /** 状态 */
  status: 'granted' | 'revoked';
  /** 发放时间 */
  granted_at: string;
}
