/**
 * Next.js 配置
 * - React strict mode 关闭（避免开发期 useEffect 执行两次导致验证码重复加载）
 * - CSP 显式放行 Cloudflare Turnstile 所需的所有资源
 * - 绝对不设置 Cross-Origin-Embedder-Policy / Cross-Origin-Opener-Policy
 *   这两个头会破坏 Turnstile iframe 与父窗口的 postMessage 通道，
 *   导致 "Failed to execute 'postMessage' on 'DOMWindow': target origin mismatch"
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // CSP：显式放行 challenges.cloudflare.com
            // default-src 不设为 'self'，否则 Turnstile blob: worker 会失败
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' https: data: blob:",
              // 显式列出 challenges.cloudflare.com，避免 CSP 严格匹配导致脚本被拦截
              "script-src 'self' https://challenges.cloudflare.com https://*.challenges.cloudflare.com 'unsafe-inline' 'unsafe-eval' blob:",
              "script-src-attr 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https: data: blob:",
              // Turnstile siteverify / 前端 API / Supabase
              "connect-src 'self' https://challenges.cloudflare.com https://*.challenges.cloudflare.com https: blob: wss:",
              // Turnstile 内部 iframe 来源 + 自己站
              "frame-src 'self' https://challenges.cloudflare.com https://*.challenges.cloudflare.com blob:",
              "child-src 'self' https://challenges.cloudflare.com blob:",
              // Turnstile 用 blob: 加载 Web Worker
              "worker-src 'self' blob:",
              "font-src 'self' data: https:",
              "media-src 'self' https: data: blob:",
              "form-action 'self' https:",
              "base-uri 'self'",
              // 允许 Turnstile 嵌入当前站，不允许被其他网站嵌入
              "frame-ancestors 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          // 注意：此处故意不设置以下头，它们会破坏 Turnstile：
          //   - Cross-Origin-Embedder-Policy: credentialless —— 会让 Turnstile iframe 拿不到 cookie
          //   - Cross-Origin-Opener-Policy: same-origin —— 会让 iframe 的 postMessage target origin 为 null
          //   - Cross-Origin-Resource-Policy: cross-origin —— 会阻断脚本跨域加载
        ],
      },
    ];
  },
};

module.exports = nextConfig;
