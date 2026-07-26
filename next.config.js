/** Next.js 配置 - 适配 Vercel 部署 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生产构建时 eslint 检查不阻断
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 类型检查在构建时不阻断（已通过 npm run check 单独校验）
  typescript: {
    ignoreBuildErrors: false,
  },
  // 图片域名白名单（Supabase Storage CDN）
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
    ],
  },
  // 实验性配置：服务端组件外置化部分依赖
  experimental: {
    serverComponentsExternalPackages: ['@supabase/ssr'],
  },
};

module.exports = nextConfig;
