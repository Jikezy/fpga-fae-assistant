'use client'

import { useState, useEffect } from 'react'

interface Stats {
  summary: {
    totalRequests: number
    totalTokens: number
    estimatedCost: number
    avgLatency: number
  }
  byProvider: { provider_name: string; requests: number; tokens: number; cost: number }[]
  byModel: { model: string; requests: number; tokens: number; cost: number }[]
  recentLogs: {
    id: string
    provider_name: string | null
    model: string | null
    input_tokens: number
    output_tokens: number
    latency_ms: number
    status: string
    error_message: string | null
    created_at: string
  }[]
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [range, setRange] = useState('7d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/proxy/stats?range=${range}`)
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [range])

  const ranges = [
    { value: 'today', label: '今天' },
    { value: '7d', label: '7天' },
    { value: '30d', label: '30天' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = '/providers'}
              className="p-2 rounded-xl hover:bg-white/80 transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">用量统计</h1>
          </div>
          <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden">
            {ranges.map(r => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  range === r.value ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full" />
          </div>
        ) : stats ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: '总请求数', value: stats.summary.totalRequests.toLocaleString(), color: 'blue' },
                { label: '总 Token', value: stats.summary.totalTokens.toLocaleString(), color: 'green' },
                { label: '估算费用', value: `$${stats.summary.estimatedCost.toFixed(4)}`, color: 'yellow' },
                { label: '平均延迟', value: `${stats.summary.avgLatency}ms`, color: 'purple' },
              ].map(card => (
                <div key={card.label} className="bg-gradient-to-br from-white/95 to-gray-50/90 border border-gray-200/60 rounded-2xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
                </div>
              ))}
            </div>

            {/* By Provider */}
            {stats.byProvider.length > 0 && (
              <div className="bg-white/95 border border-gray-200/60 rounded-2xl p-5 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3">按供应商</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">供应商</th>
                      <th className="pb-2 font-medium text-right">请求数</th>
                      <th className="pb-2 font-medium text-right">Token</th>
                      <th className="pb-2 font-medium text-right">费用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byProvider.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 font-medium text-gray-800">{row.provider_name}</td>
                        <td className="py-2 text-right text-gray-600">{row.requests}</td>
                        <td className="py-2 text-right text-gray-600">{row.tokens.toLocaleString()}</td>
                        <td className="py-2 text-right text-gray-600">${row.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* By Model */}
            {stats.byModel.length > 0 && (
              <div className="bg-white/95 border border-gray-200/60 rounded-2xl p-5 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3">按模型</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">模型</th>
                      <th className="pb-2 font-medium text-right">请求数</th>
                      <th className="pb-2 font-medium text-right">Token</th>
                      <th className="pb-2 font-medium text-right">费用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byModel.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 font-medium text-gray-800 font-mono text-xs">{row.model}</td>
                        <td className="py-2 text-right text-gray-600">{row.requests}</td>
                        <td className="py-2 text-right text-gray-600">{row.tokens.toLocaleString()}</td>
                        <td className="py-2 text-right text-gray-600">${row.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Recent Logs */}
            <div className="bg-white/95 border border-gray-200/60 rounded-2xl p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">最近请求日志</h2>
              {stats.recentLogs.length === 0 ? (
                <p className="text-sm text-gray-500 italic">暂无请求记录</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 font-medium">时间</th>
                        <th className="pb-2 font-medium">供应商</th>
                        <th className="pb-2 font-medium">模型</th>
                        <th className="pb-2 font-medium text-right">Token</th>
                        <th className="pb-2 font-medium text-right">延迟</th>
                        <th className="pb-2 font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentLogs.map(log => (
                        <tr key={log.id} className="border-b border-gray-50">
                          <td className="py-1.5 text-gray-600 text-xs">
                            {new Date(log.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-1.5 text-gray-800">{log.provider_name || '-'}</td>
                          <td className="py-1.5 text-gray-600 font-mono text-xs">{log.model || '-'}</td>
                          <td className="py-1.5 text-right text-gray-600">{(log.input_tokens + log.output_tokens).toLocaleString()}</td>
                          <td className="py-1.5 text-right text-gray-600">{log.latency_ms}ms</td>
                          <td className="py-1.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              log.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {log.status === 'success' ? '成功' : '失败'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-center text-gray-500">加载失败</p>
        )}
      </div>
    </div>
  )
}
