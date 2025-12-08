/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生成浏览器可用的 source map，方便线上或预览环境打断点调试
  productionBrowserSourceMaps: true,
  experimental: {
    // 确保无头浏览器依赖被打包进 Vercel 函数，避免缺少 libnss3 等系统库
    outputFileTracingIncludes: {
      '/app/api/inspections/pdf/route': [
        './node_modules/@sparticuz/chromium/**',
      ],
    },
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.devtool = 'source-map'
    }
    // 避免服务端打包 Puppeteer/Chromium 时报 private field 解析错误，保持为 runtime 依赖
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('@sparticuz/chromium', 'puppeteer-core')
    }
    return config
  },
}

module.exports = nextConfig
