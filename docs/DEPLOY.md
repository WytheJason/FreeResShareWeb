# 软件/影视网盘资源分享论坛 - 部署教程

本文档指导你完成从零到上线的完整部署流程。预计耗时 30-60 分钟。

---

## 部署架构概览

```
用户浏览器
    ↓
Vercel (Next.js 服务端函数)
    ↓                          ↓
Supabase (PostgreSQL)      极验 GeeTest4 API
- Auth 用户认证             - 人机验证
- 数据表存储                - 票据二次校验
- Storage 图片存储
```

---

## 一、准备账号

### 1.1 注册 Supabase

1. 访问 https://supabase.com 注册账号（支持 GitHub 登录）
2. 创建新项目：
   - Project Name: `free-res-share`
   - Database Password: 设置强密码并妥善保存
   - Region: 选择离你最近的区域（如 Northeast Asia - Tokyo / Singapore）
3. 等待项目初始化完成（约 2 分钟）

### 1.2 注册极验 GeeTest

1. 访问 https://www.geetest.com 注册账号
2. 实名认证（个人或企业）
3. 进入「验证码 4.0」控制台
4. 创建新应用：
   - 应用名称: `软件/影视网盘资源分享论坛`
   - 验证场景: 网页
   - 域名: 填写你的域名（测试阶段可填 `localhost`）
5. 获取配置参数：
   - **Captcha ID**（公开，前端使用）
   - **Captcha Key**（保密，后端使用）

> 极验提供免费额度（每日 2000 次验证），个人项目足够使用。

### 1.3 注册 Vercel

1. 访问 https://vercel.com 注册账号（推荐 GitHub 登录）
2. 完成账号激活

---

## 二、初始化 Supabase 数据库

### 2.1 执行建表 SQL

1. 进入 Supabase Dashboard > SQL Editor
2. 点击 `New query`
3. 打开项目根目录的 `sql/schema.sql` 文件，复制全部内容
4. 粘贴到 SQL Editor
5. 点击 `Run` 执行

执行成功后，将创建以下内容：
- 6 张数据表：`user_profile`、`posts`、`comments`、`report`、`collect`、`vip_log`
- 4 个触发器：自动创建用户资料、自动维护帖子数/评论数、自动更新时间戳
- 全套 RLS 行级安全策略
- Storage 桶 `covers`（用于存储帖子封面图）

### 2.2 获取 Supabase 密钥

进入 Dashboard > Project Settings > API：

| 字段 | 用途 | 在哪里使用 |
|------|------|----------|
| Project URL | 项目 URL | `NEXT_PUBLIC_SUPABASE_URL` |
| anon public | 客户端公钥（受 RLS 保护） | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role | 服务端密钥（绕过 RLS，**严格保密**） | `SUPABASE_SERVICE_ROLE_KEY` |

> 注意：新版 Supabase 可能显示为 `sb_publishable_xxx` 和 `sb_secret_xxx` 格式的 API Key，与传统 JWT 格式等效，可直接使用。

---

## 三、配置环境变量

### 3.1 本地开发

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

填入以下字段：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://你的项目标识.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon公钥
SUPABASE_SERVICE_ROLE_KEY=你的service_role密钥

# 极验 GeeTest
NEXT_PUBLIC_GEETEST_CAPTCHA_ID=你的CaptchaID
GEETEST_CAPTCHA_KEY=你的CaptchaKey

# 站点
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ICP_NUMBER=               # 如有备案号填写，无则留空
ADMIN_INITIAL_EMAIL=你的管理员邮箱
```

### 3.2 启动本地开发服务器

```bash
npm install
npm run dev
```

访问 http://localhost:3000 即可看到网站。

---

## 四、设置首个管理员

1. 先在前端 `/login` 页面注册一个账号（用你的管理员邮箱）
2. 回到 Supabase Dashboard > SQL Editor
3. 执行以下 SQL（替换邮箱）：

```sql
update public.user_profile
set is_admin = true
where email = '你的管理员邮箱';
```

4. 重新登录该账号，即可在导航栏看到「管理员后台」入口

---

## 五、部署到 Vercel

### 5.1 推送代码到 GitHub

```bash
git init
git add .
git commit -m "feat: 资源分享论坛初始化"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库.git
git push -u origin main
```

> 注意：`.env.local` 已在 `.gitignore` 中，不会被提交。Vercel 上需重新配置。

### 5.2 在 Vercel 创建项目

1. 访问 https://vercel.com/new
2. 选择你的 GitHub 仓库
3. Framework Preset 自动识别为 `Next.js`
4. **不要勾选** "Override Build Command"（使用默认 `next build`）
5. 展开环境变量配置，依次添加：

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | 你的 Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 anon 公钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的 service_role 密钥 |
| `NEXT_PUBLIC_GEETEST_CAPTCHA_ID` | 极验 Captcha ID |
| `GEETEST_CAPTCHA_KEY` | 极验 Captcha Key |
| `NEXT_PUBLIC_SITE_URL` | 你的 Vercel 域名（部署后回填） |
| `NEXT_PUBLIC_ICP_NUMBER` | 备案号（如有） |
| `ADMIN_INITIAL_EMAIL` | 管理员邮箱 |

6. 点击 `Deploy` 等待部署完成（约 2-3 分钟）

### 5.3 配置自定义域名（可选）

1. 进入 Vercel 项目 > Settings > Domains
2. 添加你的域名（如 `res.example.com`）
3. 按提示到域名服务商添加 CNAME 记录

### 5.4 回填极验后台域名

1. 回到极验后台 > 应用设置
2. 将域名更新为你的正式域名（如 `res.example.com`）
3. 否则极验在生产环境会拒绝验证

### 5.5 回填 NEXT_PUBLIC_SITE_URL

部署完成后，将 Vercel 分配的域名（或自定义域名）回填到 Vercel 环境变量 `NEXT_PUBLIC_SITE_URL`，然后重新部署。

---

## 六、配置 Supabase Auth（重要）

### 6.1 关闭邮箱确认（开发期）

默认情况下，Supabase 注册后会发送确认邮件。开发期可关闭：

Dashboard > Authentication > Providers > Email：
- 关闭 `Confirm email`

### 6.2 配置站点 URL

Dashboard > Authentication > URL Configuration：
- Site URL: `https://你的域名`
- Redirect URLs: `https://你的域名/*`

### 6.3 配置 Storage 公开访问

确认 `covers` 桶已设为 public：

Dashboard > Storage > Policies：
- 应该已通过 SQL 脚本自动配置
- 如未生效，手动添加：
  - SELECT: public 可读
  - INSERT: authenticated 可写
  - DELETE: owner 可删

---

## 七、极验 GeeTest 详细配置

### 7.1 获取参数步骤

1. 登录极验后台 https://dashboard.geetest.com
2. 进入「验证码 4.0」>「应用管理」
3. 创建应用，填写：
   - 应用名：软件/影视网盘资源分享论坛
   - 应用类型：Web
4. 进入应用详情，找到：
   - **Captcha ID**：32 位字符串（如 `c55e8d0af86d4521aaf747171e15999a`）
   - **Captcha Key**：32 位字符串（如 `395f64a98211161bab496a7cac0a19c1`）

### 7.2 验证模式

本项目默认采用 `bind` 无感模式：
- 正常用户：自动通过，无感知
- 风险设备：自动弹出滑块验证
- 高频异常：可手动切换为强制滑块模式

### 7.3 验证流程

```
前端加载极验SDK
    ↓
用户通过验证（无感或滑块）
    ↓
前端拿到票据四元组：lot_number + captcha_output + pass_token + gen_time
    ↓
随业务请求提交到后端
    ↓
后端调用极验服务端 verify 接口二次校验
    ↓
通过则放行业务，失败返回 403
```

### 7.4 切换其他验证码服务商

本项目验证码逻辑完全封装在 `lib/geetest4.ts`，业务接口仅依赖 `CaptchaProvider` 抽象接口。

切换阿里云/腾讯云验证码步骤：
1. 新建 `lib/aliyun-captcha.ts` 或 `lib/tencent-captcha.ts`
2. 实现 `CaptchaProvider` 接口
3. 修改 `lib/geetest4.ts` 的 `getCaptchaProvider()` 工厂函数返回新实现
4. 替换前端 `components/GeetestWidget.tsx` 加载对应 SDK

无需修改任何业务接口代码。

---

## 八、常见问题排查

### Q1: 注册时提示"人机验证失败"

- 检查 `NEXT_PUBLIC_GEETEST_CAPTCHA_ID` 和 `GEETEST_CAPTCHA_KEY` 是否正确
- 检查极验后台域名是否包含当前访问的域名
- 查看服务端日志是否有极验请求记录

### Q2: 登录后个人中心显示空白

- 检查 Supabase 触发器是否执行成功（SQL Editor 查询 `select * from user_profile`）
- 如未自动创建 user_profile，手动执行：

```sql
insert into public.user_profile (id, email, nickname)
select id, email, split_part(email, '@', 1)
from auth.users
where id not in (select id from public.user_profile);
```

### Q3: 发帖提示"权限不足"

- 确认账号未被封禁（`select is_banned from user_profile where email='你的邮箱'`）
- 确认已登录（导航栏右上角显示头像）

### Q4: VIP 加密资源看不到链接

- 检查 `is_vip` 是否为 true 且 `vip_expired_at` 大于当前时间
- 管理员后台开通 VIP 后需重新登录刷新会话

### Q5: 封面上传失败

- 确认 Storage 桶 `covers` 已创建且为 public
- 确认 RLS 策略允许 authenticated 用户上传
- 检查文件大小（建议 < 2MB）

### Q6: Vercel 部署后接口超时

- Vercel Hobby 套餐函数最大 10 秒
- 评论分页查询已优化（每页 20 条）
- 如仍超时，建议升级 Vercel Pro 套餐

### Q7: 本地 SWC 加载失败

如本机构建出现 `Failed to load SWC binary` 错误（常见于 OneDrive 同步路径）：

```bash
# 删除损坏的 SWC 二进制
rm -rf node_modules/@next/swc-win32-x64-msvc

# 重新安装
npm install @next/swc-win32-x64-msvc --no-save --force
```

或将项目移动到非 OneDrive 同步目录。

---

## 九、项目目录结构

```
/
├── app/                          # 页面与 API 路由
│   ├── page.tsx                  # 首页
│   ├── layout.tsx                # 全局布局
│   ├── login/                    # 登录注册
│   ├── publish/                  # 发布资源
│   ├── post/[id]/                # 帖子详情
│   ├── vip/                      # VIP 专区
│   ├── user/[id]/                # 个人中心
│   ├── admin/                    # 管理员后台
│   ├── agreement/                # 用户协议
│   ├── privacy/                  # 隐私政策
│   ├── unauthorized/             # 无权限页
│   ├── not-found.tsx             # 404
│   └── api/                      # 23 个 API 路由
├── components/                   # 13 个公共组件
├── lib/                          # 8 个工具模块
├── sql/schema.sql                # 数据库脚本
├── middleware.ts                 # 路由鉴权 + IP 限流
├── vercel.json                   # Vercel 部署配置
├── .env.example                  # 环境变量模板
└── tailwind.config.js            # 样式配置
```

---

## 十、技术支持

如部署遇到问题，请检查：
1. 浏览器 Console 报错信息
2. Vercel Functions 日志
3. Supabase 日志（Dashboard > Logs）
4. 极验后台调用统计

完成部署后，建议执行以下安全加固：
- 修改 Supabase 数据库密码
- 限制 Storage 桶访问频率
- 定期备份用户数据
- 监控异常登录行为
