'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Provider {
  id: string
  name: string
  base_url: string
  api_key: string
  model: string
  api_format: string
  icon: string | null
  notes: string | null
  priority: number
  is_active: boolean
  health_status: string
  consecutive_failures: number
  last_used_at: string | null
}

interface ProxyKey {
  id: string
  key_prefix: string
  name: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

const PRESETS = [
  { name: '云雾AI', base_url: 'https://yunwu.ai/v1', model: 'claude-sonnet-4-20250514', icon: '☁️' },
  { name: '米醋API', base_url: 'https://www.openclaudecode.cn/v1', model: 'claude-sonnet-4-20250514', icon: '🍶' },
  { name: 'SiliconFlow', base_url: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', icon: '🔵' },
  { name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', icon: '🐋' },
  { name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4', icon: '🔀' },
  { name: 'OpenAI', base_url: 'https://api.openai.com/v1', model: 'gpt-4o', icon: '🤖' },
]

const healthColors: Record<string, string> = {
  healthy: 'bg-green-400',
  degraded: 'bg-yellow-400',
  down: 'bg-red-400',
  unknown: 'bg-gray-400',
}

const healthLabels: Record<string, string> = {
  healthy: '正常',
  degraded: '降级',
  down: '不可用',
  unknown: '未知',
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [proxyKeys, setProxyKeys] = useState<ProxyKey[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [proxyConfig, setProxyConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editProvider, setEditProvider] = useState<Provider | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formBaseUrl, setFormBaseUrl] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formFormat, setFormFormat] = useState('auto')
  const [formIcon, setFormIcon] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers')
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers)
      }
    } catch (e) {
      console.error('获取供应商失败:', e)
    }
  }, [])

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/key')
      if (res.ok) {
        const data = await res.json()
        setProxyKeys(data.keys)
      }
    } catch (e) {
      console.error('获取代理Key失败:', e)
    }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/config')
      if (res.ok) {
        const data = await res.json()
        setProxyConfig(data)
      }
    } catch (e) {
      console.error('获取代理配置失败:', e)
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchProviders(), fetchKeys(), fetchConfig()]).finally(() => setLoading(false))
  }, [fetchProviders, fetchKeys, fetchConfig])

  const openAddDialog = (preset?: typeof PRESETS[0]) => {
    setEditProvider(null)
    setFormName(preset?.name || '')
    setFormBaseUrl(preset?.base_url || '')
    setFormApiKey('')
    setFormModel(preset?.model || '')
    setFormFormat('auto')
    setFormIcon(preset?.icon || '')
    setFormNotes('')
    setShowDialog(true)
  }

  const openEditDialog = (p: Provider) => {
    setEditProvider(p)
    setFormName(p.name)
    setFormBaseUrl(p.base_url)
    setFormApiKey('')
    setFormModel(p.model)
    setFormFormat(p.api_format)
    setFormIcon(p.icon || '')
    setFormNotes(p.notes || '')
    setShowDialog(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editProvider) {
        const body: any = {
          name: formName,
          base_url: formBaseUrl,
          model: formModel,
          api_format: formFormat,
          icon: formIcon,
          notes: formNotes,
        }
        if (formApiKey) body.api_key = formApiKey
        await fetch(`/api/providers/${editProvider.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        await fetch('/api/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            base_url: formBaseUrl,
            api_key: formApiKey,
            model: formModel,
            api_format: formFormat,
            icon: formIcon,
            notes: formNotes,
          }),
        })
      }
      setShowDialog(false)
      await fetchProviders()
    } catch (e) {
      console.error('保存失败:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此供应商？')) return
    await fetch(`/api/providers/${id}`, { method: 'DELETE' })
    await fetchProviders()
  }

  const handleActivate = async (id: string) => {
    await fetch(`/api/providers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate' }),
    })
    await fetchProviders()
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    setTestResult(null)
    try {
      const res = await fetch(`/api/providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      })
      const data = await res.json()
      setTestResult({ id, success: data.success, message: data.message })
      await fetchProviders()
    } catch (e) {
      setTestResult({ id, success: false, message: '测试请求失败' })
    } finally {
      setTestingId(null)
    }
  }

  const handleGenerateKey = async () => {
    const res = await fetch('/api/proxy/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Default' }),
    })
    if (res.ok) {
      const data = await res.json()
      setNewKey(data.key)
      await fetchKeys()
      await fetchConfig()
    }
  }

  const handleDeleteKey = async (id: string) => {
    if (!confirm('确定吊销此 Key？')) return
    await fetch('/api/proxy/key', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await fetchKeys()
  }

  // Drag & Drop
  const handleDragStart = (id: string) => setDraggedId(id)
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragOverId(id)
  }
  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDragOverId(null)
      setDraggedId(null)
      return
    }
    const newOrder = [...providers]
    const fromIdx = newOrder.findIndex(p => p.id === draggedId)
    const toIdx = newOrder.findIndex(p => p.id === targetId)
    const [moved] = newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, moved)
    setProviders(newOrder)
    setDragOverId(null)
    setDraggedId(null)

    await fetch('/api/providers/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: newOrder.map(p => p.id) }),
    })
  }

  const activeProvider = providers.find(p => p.is_active)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = '/chat'}
              className="p-2 rounded-xl hover:bg-white/80 transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">AI 服务管理</h1>
          </div>
          <a
            href="/providers/stats"
            className="px-4 py-2 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            用量统计
          </a>
        </div>

        {/* Active Provider */}
        {activeProvider && (
          <div className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] border-2 border-blue-400/50 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2.5 h-2.5 rounded-full ${healthColors[activeProvider.health_status]}`} />
              <span className="text-sm font-semibold text-blue-600">当前活跃供应商</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{activeProvider.icon || '🔌'}</span>
              <div>
                <h3 className="font-bold text-gray-800">{activeProvider.name}</h3>
                <p className="text-sm text-gray-600">{activeProvider.model}</p>
              </div>
            </div>
          </div>
        )}

        {/* Provider List */}
        <div className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] border border-gray-200/60 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
          <h2 className="font-semibold text-gray-800 mb-4">供应商列表（拖拽排序故障切换优先级）</h2>

          <div className="space-y-3">
            {providers.map(p => (
              <div
                key={p.id}
                draggable
                onDragStart={() => handleDragStart(p.id)}
                onDragOver={(e) => handleDragOver(e, p.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={() => handleDrop(p.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  p.is_active ? 'border-blue-400/50 bg-blue-50/50' : 'border-gray-200/60 bg-white/60'
                } ${dragOverId === p.id ? 'border-blue-400 bg-blue-50' : ''} hover:shadow-md`}
              >
                <div className="cursor-grab text-gray-400 hover:text-gray-600 select-none text-lg">≡</div>
                <span className="text-xl">{p.icon || '🔌'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{p.name}</span>
                    <div className={`w-2 h-2 rounded-full ${healthColors[p.health_status]}`} title={healthLabels[p.health_status]} />
                    <span className="text-xs text-gray-500">{healthLabels[p.health_status]}</span>
                    {p.is_active && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">活跃</span>}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{p.model} · {p.base_url}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!p.is_active && (
                    <button
                      onClick={() => handleActivate(p.id)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      激活
                    </button>
                  )}
                  <button
                    onClick={() => openEditDialog(p)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleTest(p.id)}
                    disabled={testingId === p.id}
                    className="px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 rounded-lg transition-all disabled:opacity-50"
                  >
                    {testingId === p.id ? '测试中...' : '测试'}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-3 px-4 py-2 rounded-xl text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
            >
              {testResult.message}
            </motion.div>
          )}

          {/* Presets + Add */}
          <div className="mt-5">
            <p className="text-sm font-medium text-gray-600 mb-2">快速添加预设供应商</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => openAddDialog(preset)}
                  className="px-3 py-1.5 text-sm font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-all flex items-center gap-1.5"
                >
                  {preset.icon} {preset.name}
                </button>
              ))}
              <button
                onClick={() => openAddDialog()}
                className="px-3 py-1.5 text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-all"
              >
                + 自定义
              </button>
            </div>
          </div>
        </div>

        {/* Proxy Config */}
        <div className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] border border-gray-200/60 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
          <h2 className="font-semibold text-gray-800 mb-4">代理配置（供 Claude Code 等工具使用）</h2>

          {/* Proxy Keys */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Proxy Key</span>
              <button
                onClick={handleGenerateKey}
                className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
              >
                生成新 Key
              </button>
            </div>

            {newKey && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-yellow-50 border border-yellow-200 rounded-xl p-3"
              >
                <p className="text-xs text-yellow-800 mb-1 font-semibold">请立即复制保存，此 Key 仅显示一次：</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-yellow-100 px-3 py-2 rounded-lg break-all font-mono">{newKey}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(newKey); }}
                    className="px-3 py-2 text-xs bg-yellow-200 hover:bg-yellow-300 rounded-lg transition-all font-medium"
                  >
                    复制
                  </button>
                </div>
              </motion.div>
            )}

            {proxyKeys.map(k => (
              <div key={k.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl text-sm">
                <code className="flex-1 text-gray-700 font-mono">{k.key_prefix}••••••••</code>
                <span className="text-xs text-gray-500">{k.name}</span>
                <button
                  onClick={() => handleDeleteKey(k.id)}
                  className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
                >
                  吊销
                </button>
              </div>
            ))}

            {proxyKeys.length === 0 && !newKey && (
              <p className="text-sm text-gray-500 italic">暂无代理 Key，请点击上方按钮生成</p>
            )}
          </div>

          {/* Config Snippet */}
          {proxyConfig && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Base URL:</span>
                <code className="text-sm bg-gray-100 px-3 py-1 rounded-lg font-mono text-gray-800">{proxyConfig.baseUrl}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(proxyConfig.baseUrl)}
                  className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded-lg transition-all"
                >
                  复制
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-600">Claude Code 配置</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(proxyConfig.configSnippet)}
                    className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded-lg transition-all"
                  >
                    一键复制
                  </button>
                </div>
                <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-xl overflow-x-auto font-mono">{proxyConfig.configSnippet}</pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <AnimatePresence>
        {showDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setShowDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-800">
                  {editProvider ? '编辑供应商' : '添加供应商'}
                </h3>

                {!editProvider && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">快速填充预设</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESETS.map(p => (
                        <button
                          key={p.name}
                          onClick={() => {
                            setFormName(p.name)
                            setFormBaseUrl(p.base_url)
                            setFormModel(p.model)
                            setFormIcon(p.icon)
                          }}
                          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-all"
                        >
                          {p.icon} {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">名称 *</label>
                    <input
                      type="text" value={formName} onChange={e => setFormName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="例如: 云雾AI"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Base URL *</label>
                    <input
                      type="text" value={formBaseUrl} onChange={e => setFormBaseUrl(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                      placeholder="https://api.example.com/v1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">API Key *</label>
                    <input
                      type="password" value={formApiKey} onChange={e => setFormApiKey(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                      placeholder={editProvider ? '留空保持不变' : 'sk-xxx...'}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">模型 *</label>
                    <input
                      type="text" value={formModel} onChange={e => setFormModel(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                      placeholder="claude-sonnet-4-20250514"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">API 格式</label>
                    <select
                      value={formFormat} onChange={e => setFormFormat(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="auto">自动检测</option>
                      <option value="openai">OpenAI 兼容</option>
                      <option value="anthropic">Anthropic 原生</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">图标</label>
                      <input
                        type="text" value={formIcon} onChange={e => setFormIcon(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="☁️"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">备注</label>
                      <input
                        type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="可选备注"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowDialog(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !formName || !formBaseUrl || (!editProvider && !formApiKey) || !formModel}
                    className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
