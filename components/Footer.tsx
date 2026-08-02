import Link from 'next/link';

// ICP 备案号（从环境变量读取）
const ICP_NUMBER = process.env.NEXT_PUBLIC_ICP_NUMBER || '';
// 免责声明文案
const DISCLAIMER =
  '本站所有资源来自网络，仅作学习交流，严禁用于商业用途，下载后请在24小时内删除';

/**
 * 全局底部组件
 * 三列信息 + 底部版权/ICP/免责声明
 */
export default function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-bg-base">
      <div className="mx-auto max-w-7xl px-4 py-10">
        {/* 三列信息 */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* 站点信息 */}
          <div>
            <h3 className="mb-3 text-base font-semibold text-text-primary">软件/影视网盘资源分享论坛</h3>
            <p className="text-xs leading-6 text-text-dim">
              本站是一个面向技术爱好者与影视爱好者的网盘资源分享社区，
              提供软件工具、影视剧集等资源的分享与交流平台。
            </p>
          </div>

          {/* 快速链接 */}
          <div>
            <h3 className="mb-3 text-base font-semibold text-text-primary">快速链接</h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/agreement" className="text-text-dim transition-colors hover:text-primary-400">
                  用户协议
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-text-dim transition-colors hover:text-primary-400">
                  隐私政策
                </Link>
              </li>
              <li>
                <Link href="/vip" className="text-text-dim transition-colors hover:text-primary-400">
                  VIP 专区
                </Link>
              </li>
            </ul>
          </div>

          {/* 联系方式 */}
          <div>
            <h3 className="mb-3 text-base font-semibold text-text-primary">联系方式</h3>
            <ul className="space-y-2 text-xs text-text-dim">
              <li>邮箱：superconductor_nt@qq.com</li>
              <li>商务合作：superconductor_nt@qq.com</li>
              <li>侵权举报：superconductor_nt@qq.com</li>
              <li>
                个人主页：
                <a
                  href="https://www.bestbzw.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:underline"
                >
                  www.bestbzw.xyz
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 底部版权行 */}
        <div className="mt-8 border-t border-border pt-6">
          <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
            <div className="text-xs text-text-dim">
              © 2026 环梦网盘资源分享论坛 · {ICP_NUMBER ? ICP_NUMBER : 'ICP备案号待填写'}
            </div>
            <Link
              href="/disclaimer"
              className="text-xs text-text-dim transition-colors hover:text-primary-400"
            >
              免责声明
            </Link>
          </div>
          {/* 免责声明文案 */}
          <p className="mt-3 text-center text-xs leading-5 text-text-dim md:text-left">
            {DISCLAIMER}
          </p>
        </div>
      </div>
    </footer>
  );
}
