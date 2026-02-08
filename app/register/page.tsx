'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'
import { motion } from 'framer-motion'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 验证密码匹配
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError(data.error || '注册失败')
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

      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/30 z-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-gradient-to-br from-white/15 to-white/8 backdrop-blur-[40px] backdrop-saturate-[180%] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.4)] p-8 border border-white/25">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-slate-500 to-slate-700 rounded-full mb-4 shadow-xl ring-2 ring-white/50">
              <svg className="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">FPGA FAE助手</h1>
            <p className="text-white/90 mt-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">创建您的账号</p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-2xl"
            >
              <p className="text-sm text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{error}</p>
            </motion.div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/30 rounded-2xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none transition text-white placeholder-white/50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/30 rounded-2xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none transition text-white placeholder-white/50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                placeholder="至少6个字符"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                确认密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/30 rounded-2xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none transition text-white placeholder-white/50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                placeholder="再次输入密码"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-400 to-cyan-600 text-white py-3 px-4 rounded-2xl hover:shadow-2xl active:scale-95 focus:ring-4 focus:ring-cyan-300/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-xl"
            >
              {loading ? '注册中...' : '注册'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              已有账号？{' '}
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                立即登录
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-white/70 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            © 2026 FPGA FAE助手. All rights reserved.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
