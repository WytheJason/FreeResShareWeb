import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '免责声明',
  description: '环梦网盘资源分享论坛 - 免责声明',
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 fade-in">
      <h1 className="text-3xl font-bold text-text-primary">免责声明</h1>
      <p className="text-text-muted">最后更新：2026 年 7 月 26 日</p>

      <div className="space-y-6 leading-relaxed text-text-secondary">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">一、资源性质</h2>
          <p>
            环梦网盘资源分享论坛（以下简称&ldquo;本站&rdquo;）是一个面向技术爱好者与内容分享爱好者的网盘资源分享社区。本站所有资源均由用户自行上传分享，本站仅提供信息存储空间服务，不对资源的合法性、完整性、安全性作任何保证。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">二、使用限制</h2>
          <p>
            本站所有资源仅供学习交流使用，严禁用于任何商业用途。下载资源的用户请在下载后 24 小时内自行删除，如您喜欢相关内容，请支持正版。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">三、风险自负</h2>
          <p>
            因使用本站资源导致的任何直接或间接损失，包括但不限于设备损坏、数据丢失、系统故障、法律纠纷等，本站不承担任何责任。用户应自行判断资源的安全性与适用性，谨慎下载和使用。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">四、知识产权</h2>
          <p>
            本站尊重知识产权，用户发布的内容版权归原作者所有。如果您认为本站上有任何内容侵犯了您的合法权益，请通过侵权举报邮箱联系我们，我们将在核实后及时处理。
          </p>
          <p>侵权举报邮箱：superconductor_nt@qq.com</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">五、服务变更与中断</h2>
          <p>
            本站有权根据法律法规、监管要求或自身运营需要，随时修改、暂停或终止部分或全部服务，无需提前通知用户。由此造成的任何影响，本站不承担责任。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">六、外部链接</h2>
          <p>
            本站可能包含第三方网站或资源的链接（如网盘分享链接），这些链接仅为方便用户而提供。本站不对第三方网站的内容、产品或服务承担任何责任，用户访问第三方网站所产生的风险由用户自行承担。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">七、声明修改</h2>
          <p>
            本站有权根据法律法规变化或业务需要修改本免责声明，修改后的声明自发布之日起生效。用户继续使用本站服务即视为同意修改后的声明。
          </p>
        </section>
      </div>
    </div>
  );
}
