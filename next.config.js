/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生成浏览器可用的 source map，方便线上或预览环境打断点调试
  productionBrowserSourceMaps: true,
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.devtool = 'source-map'
    }
    return config
  },
}

module.exports = nextConfig
