/** TailwindCSS 全局样式配置 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // 主色调：深色科技蓝 + 电光蓝 + VIP金色
      colors: {
        // 背景层级
        bg: {
          base: '#0B1220',      // 主背景
          surface: '#111A2E',   // 卡片表面
          elevated: '#1A2540',  // 弹层/悬浮
          hover: '#22305A',     // 悬停态
        },
        // 主色（电光蓝）
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        // VIP 金色
        gold: {
          50: '#FEF9E7',
          100: '#FDF0C4',
          200: '#FBE58C',
          300: '#F8D74A',
          400: '#F5C242',
          500: '#E0A82E',
          600: '#B98420',
          700: '#8C6219',
          800: '#5E4210',
          900: '#3A2A08',
        },
        // 辅助色
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        // 文字层级
        text: {
          primary: '#F1F5F9',
          secondary: '#CBD5E1',
          muted: '#94A3B8',
          dim: '#64748B',
        },
        // 边框
        border: {
          DEFAULT: '#1E293B',
          subtle: '#334155',
        },
      },
      // 字体
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      // 圆角
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      // 动画
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 194, 66, 0.4)' },
          '50%': { boxShadow: '0 0 0 6px rgba(245, 194, 66, 0)' },
        },
      },
    },
  },
  plugins: [],
};
