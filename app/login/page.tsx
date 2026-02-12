'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        router.push('/chat')
        router.refresh()
      } else {
        setError(data.error || '登录失败')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <LiquidGlassBackground />
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50/20 via-transparent to-purple-100/20 z-0" />

      {/* 装饰性漂浮云朵 */}
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[15%] left-[8%] z-0 opacity-20"
      >
        <svg width="120" height="50" viewBox="0 0 120 50" fill="none">
          <ellipse cx="60" cy="30" rx="55" ry="18" fill="url(#cloud1)" />
          <ellipse cx="35" cy="25" rx="30" ry="22" fill="url(#cloud1)" />
          <ellipse cx="85" cy="25" rx="30" ry="20" fill="url(#cloud1)" />
          <defs><linearGradient id="cloud1" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f97316"/><stop offset="1" stopColor="#a855f7"/></linearGradient></defs>
        </svg>
      </motion.div>
      <motion.div
        animate={{ x: [0, -20, 0], y: [0, 8, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-[20%] right-[10%] z-0 opacity-15"
      >
        <svg width="100" height="40" viewBox="0 0 100 40" fill="none">
          <ellipse cx="50" cy="24" rx="45" ry="14" fill="url(#cloud2)" />
          <ellipse cx="30" cy="20" rx="25" ry="18" fill="url(#cloud2)" />
          <ellipse cx="70" cy="20" rx="25" ry="16" fill="url(#cloud2)" />
          <defs><linearGradient id="cloud2" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a855f7"/><stop offset="1" stopColor="#f97316"/></linearGradient></defs>
        </svg>
      </motion.div>

      {/* 装饰性手里剑 */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute top-[25%] right-[15%] z-0 opacity-10"
      >
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <path d="M30 0L35 25L60 30L35 35L30 60L25 35L0 30L25 25Z" fill="#f97316" />
        </svg>
      </motion.div>
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute bottom-[30%] left-[12%] z-0 opacity-8"
      >
        <svg width="40" height="40" viewBox="0 0 60 60" fill="none">
          <path d="M30 0L35 25L60 30L35 35L30 60L25 35L0 30L25 25Z" fill="#a855f7" />
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-5 sm:p-8 border border-gray-200/60 relative overflow-hidden">
          {/* 卡片内装饰 - 漩涡纹（致敬漩涡一族） */}
          <div className="absolute -top-16 -right-16 w-32 h-32 opacity-[0.04]">
            <svg viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="45" stroke="#f97316" strokeWidth="3" />
              <path d="M50 5C50 5 80 20 80 50C80 80 50 80 50 50C50 30 35 25 50 5Z" fill="#f97316" />
            </svg>
          </div>
          <div className="absolute -bottom-12 -left-12 w-24 h-24 opacity-[0.04]">
            <svg viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="45" stroke="#a855f7" strokeWidth="3" />
              <path d="M50 5C50 5 80 20 80 50C80 80 50 80 50 50C50 30 35 25 50 5Z" fill="#a855f7" />
            </svg>
          </div>

          {/* Logo - 木叶 × FPGA */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center mb-8 relative"
          >
            <div className="relative inline-block">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full mb-4 shadow-[0_8px_30px_rgba(249,115,22,0.35)] ring-2 ring-orange-200 border border-orange-300">
                {/* 木叶标志简化版 */}
                <svg className="w-10 h-10 text-white" viewBox="0 0 48 48" fill="currentColor">
                  <path d="M24 4C24 4 36 12 36 24C36 36 24 40 24 40C24 40 12 36 12 24C12 12 24 4 24 4Z" fillOpacity="0.9"/>
                  <path d="M24 10C24 10 32 16 32 24C32 32 24 36 24 36" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  <line x1="24" y1="14" x2="24" y2="38" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
                </svg>
              </div>
              {/* 护额横条 */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-28 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent rounded-full"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mt-2">FPGA FAE助手</h1>
            <p className="text-gray-500 mt-1.5 text-sm flex items-center justify-center gap-1.5">
              <span className="inline-block w-3 h-[2px] bg-orange-300 rounded-full"></span>
              登录您的忍者账号
              <span className="inline-block w-3 h-[2px] bg-orange-300 rounded-full"></span>
            </p>
          </motion.div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl"
            >
              <p className="text-sm text-red-600">{error}</p>
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white/80 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all text-gray-800 placeholder-gray-400"
                placeholder="your@email.com"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white/80 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all text-gray-800 placeholder-gray-400"
                placeholder="••••••••"
              />
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3.5 px-4 rounded-2xl hover:shadow-[0_8px_30px_rgba(249,115,22,0.4)] active:scale-95 focus:ring-4 focus:ring-orange-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="inline-block w-5 h-5"
                  >
                    <svg viewBox="0 0 60 60" fill="none">
                      <path d="M30 0L35 25L60 30L35 35L30 60L25 35L0 30L25 25Z" fill="white" />
                    </svg>
                  </motion.span>
                  结印中...
                </span>
              ) : '登录'}
            </motion.button>
          </form>

          {/* Register Link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-gray-600">
              还没有账号？{' '}
              <Link href="/register" className="text-orange-600 hover:text-orange-700 font-medium transition-colors underline decoration-transparent hover:decoration-orange-500">
                立即注册
              </Link>
            </p>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-gray-500">
            © 2026 FPGA FAE助手 - 木叶技术部
          </p>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-500 transition-colors">
            鄂ICP备2026007985号
          </a>
        </motion.div>
      </motion.div>
    </div>
  )
}
