'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://yunwu.ai')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    checkAuth()
    loadSettings()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('验证失败:', error)
      router.push('/login')
    }
  }

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/settings')
      if (response.ok) {
        const data = await response.json()
        setHasApiKey(data.hasApiKey)
        setBaseUrl(data.anthropic_base_url || 'https://yunwu.ai')
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'API Key 不能为空' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anthropic_api_key: apiKey,
          anthropic_base_url: baseUrl,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'API配置已保存' })
        setHasApiKey(true)
        setApiKey('')
      } else {
        setMessage({ type: 'error', text: data.error || '保存失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败，请重试' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定要删除API配置吗？删除后将无法使用AI功能。')) {
      return
    }

    try {
      const response = await fetch('/api/user/settings', {
        method: 'DELETE',
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'API配置已删除' })
        setHasApiKey(false)
        setApiKey('')
      }
    } catch (error) {
      setMessage({ type: 'error', text: '删除失败' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">API 设置</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* 管理员提示 */}
          {currentUser?.role === 'admin' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-purple-900">管理员特权</h3>
                  <p className="text-sm text-purple-700 mt-1">
                    作为管理员，您可以使用系统默认的API配置，无需单独设置。如果您配置了个人API Key，将优先使用个人配置。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 状态提示 */}
          {message && (
            <div className={`p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {message.text}
              </p>
            </div>
          )}

          {/* 当前状态 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">当前状态</h2>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${hasApiKey ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <span className="text-sm text-gray-700">
                {hasApiKey ? '✅ 已配置 API Key' : '❌ 未配置 API Key'}
              </span>
            </div>
            {!hasApiKey && currentUser?.role !== 'admin' && (
              <p className="text-sm text-red-600 mt-2">
                ⚠️ 您需要配置自己的云雾AI API Key 才能使用AI功能
              </p>
            )}
          </div>

          {/* API Key 配置 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">云雾AI 配置</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key *
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? '已配置（输入新Key更新）' : 'sk-xxxxxxxxxxxxxxxxx'}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                获取 API Key：<a href="https://yunwu.ai/console" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">https://yunwu.ai/console</a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white"
              />
              <p className="mt-1 text-xs text-gray-500">
                默认为云雾AI地址，无需修改
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
            {hasApiKey && (
              <button
                onClick={handleDelete}
                className="px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
              >
                删除配置
              </button>
            )}
          </div>

          {/* 说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 使用说明</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• 配置后将使用您自己的云雾AI账户进行调用</li>
              <li>• API 费用由您的云雾AI账户承担</li>
              <li>• 管理员可选择性配置（使用系统默认配置或个人配置）</li>
              <li>• 普通用户必须配置才能使用AI功能</li>
              <li>• API Key 加密存储，仅您可见</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
