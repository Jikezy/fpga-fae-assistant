'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
        router.push('/')
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 水墨背景效果 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(100,116,139,0.2),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(71,85,105,0.2),transparent_50%)]"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-gray-900/40 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 border border-gray-600/30">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full mb-4 shadow-xl ring-2 ring-gray-500/50">
              <svg className="w-8 h-8 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-100 drop-shadow-lg">FPGA FAE助手</h1>
            <p className="text-gray-300 mt-2">登录您的账号</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 backdrop-blur-sm border border-red-700/40 rounded-2xl">
              <p className="text-sm text-gray-100">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-100 mb-2">
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800/40 backdrop-blur-sm border border-gray-600/40 rounded-2xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition text-gray-100 placeholder-gray-400"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-100 mb-2">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-800/40 backdrop-blur-sm border border-gray-600/40 rounded-2xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition text-gray-100 placeholder-gray-400"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-gray-700 to-gray-900 text-gray-100 py-3 px-4 rounded-2xl hover:shadow-2xl active:scale-95 focus:ring-4 focus:ring-gray-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-xl ring-1 ring-gray-500/50"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-200">
              还没有账号？{' '}
              <Link href="/register" className="text-gray-300 hover:text-gray-100 font-medium transition-colors">
                立即注册
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-400">
            © 2026 FPGA FAE助手. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
