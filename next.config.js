/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // 解决 ChromaDB 的兼容性问题
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'chromadb': 'commonjs chromadb',
        'onnxruntime-node': 'commonjs onnxruntime-node',
      })
    }

    // 忽略 ChromaDB 的远程模块加载
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }

    return config
  },
}

module.exports = nextConfig
