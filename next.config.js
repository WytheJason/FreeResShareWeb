/**
 * Next.js 配置
 * - React strict mode 关闭（避免开发期 useEffect 执行两次导致验证码重复加载）
 * - 允许 Cloudflare Turnstile 的 script-src / connect-src / frame-src / worker-src
 * - 移除 X-Frame-Options（Turnstile 多层 iframe 通信需要）
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  async headers() {
    return [
      {
        // 所有路径统一应用 CSP 和安全头，兼容 Turnstile 验证
        source: '/(.*)',
        headers: [
          {
            // CSP：显式放行 challenges.cloudflare.com
            // 注意：不设置 default-src 'self' 太严格的限制，否则 Turnstile blob: worker 会失败
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' https: data: blob: 'unsafe-inline'",
              "script-src 'self' https: 'unsafe-inline' 'unsafe-eval' blob:",
              "script-src-attr 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https: data: blob:",
              // Turnstile 验证请求、前端 API、Supabase 都通过 https 访问
              "connect-src 'self' https: blob: wss:",
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
          {
            // 允许跨域访问 Turnstile SDK / siteverify 资源
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
          // 不要设置 X-Frame-Options: DENY/SAMEORIGIN，会和 CSP frame-ancestors 冲突，
          // 且破坏 Turnstile 的 iframe 容器 postMessage 通道
        ],
      },
    ];
  },
};

module.exports = nextConfig;
