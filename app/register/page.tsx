'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'

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

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致。')
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
        router.push('/chat')
        router.refresh()
      } else {
        setError(data.error || '注册失败，请稍后重试。')
      }
    } catch {
      setError('网络异常，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <LiquidGlassBackground />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_14%,rgba(245,123,32,0.24),transparent_36%),radial-gradient(circle_at_16%_84%,rgba(187,35,45,0.2),transparent_30%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.2, 1, 0.35, 1] }}
        className="naruto-glass relative z-10 w-full max-w-md rounded-[2rem] p-6 sm:p-8"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-[0_12px_26px_rgba(171,64,17,0.38)]">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="naruto-title text-3xl font-black text-orange-950">创建账号</h1>
          <p className="mt-2 text-sm text-orange-900/80">加入火影主题 AI 平台，开启你的效率升级。</p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-orange-900">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="w-full rounded-2xl border border-orange-200/90 bg-white/90 px-4 py-3 text-orange-950 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-300/60"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-orange-900">
              密码
            </label>
            <input
              id="password"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="至少 6 位"
              className="w-full rounded-2xl border border-orange-200/90 bg-white/90 px-4 py-3 text-orange-950 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-300/60"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-orange-900">
              确认密码
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="再次输入密码"
              className="w-full rounded-2xl border border-orange-200/90 bg-white/90 px-4 py-3 text-orange-950 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-300/60"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="naruto-btn-accent mt-2 w-full rounded-2xl px-4 py-3.5 font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '注册中...' : '注册并进入'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-orange-900/80">
          已有账号？
          <Link href="/login" className="ml-1 font-semibold text-orange-700 underline hover:text-orange-800">
            去登录
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
