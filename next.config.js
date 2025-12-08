/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生成浏览器可用的 source map，方便线上或预览环境打断点调试
  productionBrowserSourceMaps: true,
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
