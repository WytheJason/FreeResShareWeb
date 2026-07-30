/**
 * 用户服务协议页
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '用户服务协议',
  description: '软件/影视网盘资源分享论坛 - 用户服务协议',
};

export default function AgreementPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 fade-in">
      <h1 className="text-3xl font-bold text-text-primary">用户服务协议</h1>
      <p className="text-text-muted">最后更新：2026 年 7 月 26 日</p>

      <div className="space-y-6 leading-relaxed text-text-secondary">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">一、服务说明</h2>
          <p>
            软件/影视网盘资源分享论坛（以下简称&ldquo;本站&rdquo;）是一个网盘资源分享社区，为用户提供软件工具、影视剧集等资源的发布、浏览、评论与收藏服务。本站所有资源由用户自行上传分享，本站仅提供信息存储空间服务。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">二、用户注册与账号</h2>
          <p>
            1. 用户注册时需提供真实有效的邮箱地址，并设置符合安全要求的密码。
          </p>
          <p>
            2. 用户应妥善保管账号密码，因账号泄露导致的损失由用户自行承担。
          </p>
          <p>
            3. 为防范机器人注册，本站接入极验无感人机验证服务，注册时需通过验证。
          </p>
          <p>
            4. 用户不得注册多个账号进行刷帖、灌水等违规操作，一经发现将封禁全部账号。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">三、用户行为规范</h2>
          <p>用户在使用本站服务时，应遵守中华人民共和国相关法律法规，不得发布以下内容：</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>违反宪法确定的基本原则的；</li>
            <li>危害国家安全、泄露国家秘密、颠覆国家政权、破坏国家统一的；</li>
            <li>损害国家荣誉和利益的；</li>
            <li>煽动民族仇恨、民族歧视，破坏民族团结的；</li>
            <li>破坏国家宗教政策，宣扬邪教和封建迷信的；</li>
            <li>散布谣言，扰乱社会秩序，破坏社会稳定的；</li>
            <li>散布淫秽、色情、赌博、暴力、恐怖或者教唆犯罪的；</li>
            <li>侮辱或者诽谤他人，侵害他人合法权益的；</li>
            <li>含有法律、行政法规禁止的其他内容的。</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">四、VIP 会员服务</h2>
          <p>
            1. 本站提供 VIP 会员服务，会员可查看 VIP 加密资源。
          </p>
          <p>
            2. VIP 会员权限由管理员手动开通或续费，到期后自动降级为普通用户。
          </p>
          <p>
            3. VIP 会员服务为虚拟商品，开通后不支持退款。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">五、知识产权</h2>
          <p>
            1. 本站用户发布的内容，版权归原作者所有。
          </p>
          <p>
            2. 用户不得发布侵犯他人知识产权的内容，如有侵权请通过侵权下架通道联系我们。
          </p>
          <p>
            3. 本站对自身平台的设计、代码、Logo 等享有完整知识产权。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">六、免责声明</h2>
          <p>
            1. 本站所有资源来自网络，仅作学习交流使用，严禁用于商业用途。
          </p>
          <p>
            2. 用户下载的资源应在 24 小时内删除，如喜欢请支持正版。
          </p>
          <p>
            3. 因使用本站资源导致的任何损失，本站不承担任何责任。
          </p>
          <p>
            4. 本站不对资源的完整性、安全性、可用性作任何保证。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">七、协议修改</h2>
          <p>
            本站有权根据法律法规变化或业务需要修改本协议，修改后的协议自发布之日起生效。用户继续使用本站服务即视为同意修改后的协议。
          </p>
        </section>
      </div>
    </div>
  );
}
