/**
 * 隐私政策页
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '隐私政策',
  description: '软件/影视网盘资源分享论坛 - 隐私政策',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 fade-in">
      <h1 className="text-3xl font-bold text-text-primary">隐私政策</h1>
      <p className="text-text-muted">最后更新：2026 年 7 月 26 日</p>

      <div className="space-y-6 leading-relaxed text-text-secondary">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">一、信息收集</h2>
          <p>本站在您使用服务时可能收集以下信息：</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>邮箱地址：用于注册、登录与账号找回；</li>
            <li>昵称、头像、个人简介：您自愿填写的资料信息；</li>
            <li>IP 地址：用于安全防护、IP 限流与人机验证；</li>
            <li>操作日志：发帖、评论、收藏等行为记录；</li>
            <li>极验验证数据：人机验证票据，不包含个人敏感信息。</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">二、信息使用</h2>
          <p>本站收集的信息仅用于以下目的：</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>提供账号注册、登录与个人中心服务；</li>
            <li>展示用户发帖、评论、收藏等内容；</li>
            <li>防止机器人注册、刷帖、刷评论等滥用行为；</li>
            <li>IP 限流与安全风控；</li>
            <li>改进产品体验与功能优化。</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">三、信息存储</h2>
          <p>
            您的信息存储于 Supabase 提供的 PostgreSQL 数据库服务中，数据库启用了行级安全（RLS）策略，确保用户只能访问自己有权限的数据。
            密码使用 Supabase Auth 提供的 bcrypt 算法加密存储，本站无法查看明文密码。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">四、信息共享</h2>
          <p>
            本站不会向任何第三方出售、出租您的个人信息。除以下情形外，不会共享您的信息：
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>获得您的明确同意；</li>
            <li>根据法律法规要求或司法机关、行政机关的合法要求；</li>
            <li>为维护本站的合法权益（如应对侵权投诉）；</li>
            <li>与极验等服务商共享必要的人机验证数据。</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">五、Cookie 使用</h2>
          <p>
            本站使用 Cookie 维持用户登录会话。Cookie 不包含明文密码，仅存储加密的会话令牌。您可通过浏览器设置清除 Cookie，但清除后需要重新登录。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">六、用户权利</h2>
          <p>您对个人信息享有以下权利：</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>查询权：可在个人中心查看您的资料；</li>
            <li>更正权：可编辑个人资料；</li>
            <li>删除权：可删除自己发布的帖子、评论；</li>
            <li>账号注销：如需注销账号，请联系管理员。</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">七、未成年人保护</h2>
          <p>
            本站不面向 18 岁以下未成年人提供服务。如发现未成年用户，我们将采取措施限制或终止其账号。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">八、政策修改</h2>
          <p>
            本站可能根据法律法规变化或业务调整修改本隐私政策，修改后的政策自发布之日起生效。
          </p>
        </section>
      </div>
    </div>
  );
}
