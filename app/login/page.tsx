'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'

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
        setError(data.error || '登录失败，请检查账号和密码。')
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(245,123,32,0.24),transparent_36%),radial-gradient(circle_at_88%_12%,rgba(187,35,45,0.2),transparent_32%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.2, 1, 0.35, 1] }}
        className="naruto-glass relative z-10 w-full max-w-md rounded-[2rem] p-6 sm:p-8"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-[0_12px_26px_rgba(171,64,17,0.38)]">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h1 className="naruto-title text-3xl font-black text-orange-950">欢迎归队</h1>
          <p className="mt-2 text-sm text-orange-900/80">登录后继续使用火影主题 AI 作战台。</p>
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="请输入密码"
              className="w-full rounded-2xl border border-orange-200/90 bg-white/90 px-4 py-3 text-orange-950 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-300/60"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="naruto-btn-primary mt-2 w-full rounded-2xl px-4 py-3.5 font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-orange-900/80">
          还没有账号？
          <Link href="/register" className="ml-1 font-semibold text-orange-700 underline hover:text-orange-800">
            立即注册
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
