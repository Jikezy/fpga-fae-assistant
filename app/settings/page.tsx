'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// 预设平台配置
const PRESETS = [
  { name: '云雾 AI', baseUrl: 'https://yunwu.ai/v1', model: 'claude-opus-4-20250514', hint: 'yunwu.ai/console 获取 Key' },
  { name: '米醋 API', baseUrl: 'https://www.openclaudecode.cn/v1', model: 'claude-opus-4-20250514', hint: 'openclaudecode.cn 获取 Key' },
  { name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', hint: 'siliconflow.cn 获取 Key' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', hint: 'platform.deepseek.com 获取 Key' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-opus-4', hint: 'openrouter.ai 获取 Key' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', hint: 'platform.openai.com 获取 Key' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelName, setModelName] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    checkAuth()
    loadSettings()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (!response.ok) {
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
        setBaseUrl(data.baseUrl || '')
        setModelName(data.model || '')
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePreset = (preset: typeof PRESETS[number]) => {
    setBaseUrl(preset.baseUrl)
    setModelName(preset.model)
    setMessage(null)
  }

  const handleSave = async () => {
    if (!apiKey.trim() && !hasApiKey) {
      setMessage({ type: 'error', text: 'API Key 不能为空' })
      return
    }
    if (!baseUrl.trim()) {
      setMessage({ type: 'error', text: 'Base URL 不能为空' })
      return
    }
    if (!modelName.trim()) {
      setMessage({ type: 'error', text: '模型名称不能为空' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const body: any = {
        base_url: baseUrl,
        model_name: modelName,
      }
      // 如果用户输入了新 key 则发送；否则仍需发送旧占位（后端需要非空）
      if (apiKey.trim()) {
        body.api_key = apiKey
      } else {
        // 已有 key，发送占位让后端保留
        body.api_key = '__KEEP_EXISTING__'
      }

      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'AI 配置已保存' })
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
    if (!confirm('确定要删除 AI 配置吗？删除后将无法使用对话功能，直到重新配置。')) {
      return
    }

    try {
      const response = await fetch('/api/user/settings', {
        method: 'DELETE',
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'AI 配置已删除' })
        setHasApiKey(false)
        setApiKey('')
        setBaseUrl('')
        setModelName('')
      }
    } catch (error) {
      setMessage({ type: 'error', text: '删除失败' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 relative overflow-hidden">
      {/* 水墨背景效果 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(100,116,139,0.2),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(71,85,105,0.2),transparent_50%)]"></div>

      {/* 顶部导航 */}
      <header className="bg-gray-900/30 backdrop-blur-xl shadow-lg border-b border-gray-600/30 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/chat')}
              className="p-2 hover:bg-gray-700/30 rounded-xl transition-all backdrop-blur-sm active:scale-95"
            >
              <svg className="w-6 h-6 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-100 drop-shadow-lg">AI 设置</h1>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="bg-gray-900/40 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 space-y-6 border border-gray-600/30">

          {/* 状态提示 */}
          {message && (
            <div className={`p-4 rounded-2xl backdrop-blur-sm ${
              message.type === 'success' ? 'bg-green-900/30 border border-green-700/40' : 'bg-red-900/30 border border-red-700/40'
            }`}>
              <p className="text-sm text-gray-100">{message.text}</p>
            </div>
          )}

          {/* 当前状态 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-100 mb-4">当前状态</h2>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${hasApiKey ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-gray-600'}`}></div>
              <span className="text-sm text-gray-100">
                AI 服务 — {hasApiKey ? '已配置' : '未配置'}
              </span>
            </div>
            {hasApiKey && baseUrl && (
              <p className="text-xs text-gray-400 mt-2 ml-6">
                {baseUrl} / {modelName}
              </p>
            )}
          </div>

          {/* 预设平台 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-100 mb-3">快速选择平台</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePreset(preset)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 border ${
                    baseUrl === preset.baseUrl
                      ? 'bg-blue-600/30 border-blue-500/50 text-blue-200'
                      : 'bg-gray-800/40 border-gray-600/40 text-gray-200 hover:bg-gray-700/40'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              点击预设按钮自动填充 Base URL 和推荐模型，API Key 需自行填写
            </p>
          </div>

          {/* 配置表单 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-100">AI 服务配置</h2>

            <div>
              <label className="block text-sm font-medium text-gray-100 mb-2">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full px-4 py-3 bg-gray-800/40 backdrop-blur-sm border border-gray-600/40 rounded-2xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-gray-100 placeholder-gray-400"
              />
              <p className="mt-1 text-xs text-gray-400">
                OpenAI 兼容格式的 API 地址，必须以 /v1 结尾
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-100 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? '已配置（输入新 Key 更新）' : '输入你的 API Key'}
                className="w-full px-4 py-3 bg-gray-800/40 backdrop-blur-sm border border-gray-600/40 rounded-2xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-gray-100 placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-100 mb-2">
                模型名称
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="例如 deepseek-chat、gpt-4o、claude-opus-4-20250514"
                className="w-full px-4 py-3 bg-gray-800/40 backdrop-blur-sm border border-gray-600/40 rounded-2xl focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none text-gray-100 placeholder-gray-400"
              />
              <p className="mt-1 text-xs text-gray-400">
                填写平台支持的模型 ID，可在对应平台文档中查看
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-gray-700 to-gray-900 text-gray-100 py-3 px-4 rounded-2xl hover:shadow-2xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-xl ring-1 ring-gray-500/50"
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
            {hasApiKey && (
              <button
                onClick={handleDelete}
                className="px-6 py-3 bg-red-900/40 backdrop-blur-sm border border-red-700/40 text-red-300 rounded-2xl hover:bg-red-900/60 active:scale-95 transition-all"
              >
                删除配置
              </button>
            )}
          </div>

          {/* 说明 */}
          <div className="bg-blue-900/30 backdrop-blur-sm border border-blue-700/40 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-100 mb-2">使用说明</h3>
            <ul className="text-xs text-gray-200 space-y-1">
              <li>- 本系统使用 BYOK（自带 Key）模式，需要您自行配置 AI 服务</li>
              <li>- 支持任何 OpenAI 兼容格式的 API（云雾AI、SiliconFlow、DeepSeek、OpenRouter、OpenAI 等）</li>
              <li>- 配置完成后即可在对话页面使用 AI 功能</li>
              <li>- BOM 解析使用系统内置服务，不受此设置影响</li>
              <li>- API Key 安全存储，仅您可见</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
