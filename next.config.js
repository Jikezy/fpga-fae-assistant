/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 安全响应头
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },

  webpack: (config, { isServer }) => {
    // 解决 PDF 处理的兼容性问题
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'chromadb': 'commonjs chromadb',
        'onnxruntime-node': 'commonjs onnxruntime-node',
      })
    }

    // 忽略测试文件和数据文件
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/test/**',
        '**/tests/**',
        '**/*.test.*',
        '**/*.spec.*',
      ]
    }

    // 排除测试数据文件
    config.module = config.module || {}
    config.module.rules = config.module.rules || []
    config.module.rules.push({
      test: /\.(pdf|data)$/,
      type: 'asset/resource',
      exclude: [/node_modules/, /test/, /tests/],
    })

    // 忽略 ChromaDB 和文件系统相关模块
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      path: false,
    }

    return config
  },
}

module.exports = nextConfig
