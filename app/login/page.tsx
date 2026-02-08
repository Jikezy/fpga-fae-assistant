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
      {/* 3D Liquid Glass Background */}
      <LiquidGlassBackground />

      {/* Subtle gradient overlay for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100/20 via-transparent to-gray-100/20 z-0" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] p-8 border border-gray-200/60">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full mb-4 shadow-xl ring-2 ring-blue-200 border border-blue-300">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800">FPGA FAE助手</h1>
            <p className="text-gray-600 mt-2 text-sm">登录您的账号</p>
          </motion.div>

          {/* Error Message */}
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-2">
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white/80 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all text-gray-800 placeholder-gray-500"
                placeholder="your@email.com"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-2">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white/80 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all text-gray-800 placeholder-gray-500"
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
              className="w-full bg-gradient-to-r from-blue-400 to-blue-600 text-white py-3.5 px-4 rounded-2xl hover:shadow-[0_8px_30px_rgba(59,130,246,0.4)] active:scale-95 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-xl"
            >
              {loading ? '登录中...' : '登录'}
            </motion.button>
          </form>

          {/* Register Link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-gray-700">
              还没有账号？{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium transition-colors underline decoration-transparent hover:decoration-blue-600">
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
          <p className="text-sm text-gray-600">
            © 2026 FPGA FAE助手. All rights reserved.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
