'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'

export default function BomUploadPage() {
  const router = useRouter()
  const [bomText, setBomText] = useState('')
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const exampleBom = `STM32F103C8T6 最小系统板 x2
0805贴片电容 100nF x50
0805贴片电阻 10K x50
AMS1117-3.3 稳压模块 x5
LED发光二极管 5mm 红色 x20
杜邦线 母对母 20cm x1排
2.54mm排针 单排40P x5
USB Type-C 接口模块 x2`

  const handleParse = async () => {
    if (!bomText.trim()) {
      setError('请输入 BOM 清单内容')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/bom/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: bomText,
          projectName: projectName || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '解析失败')
        return
      }

      // 跳转到项目详情页
      router.push(`/bom/project/${data.project.id}`)
    } catch (err) {
      setError('网络错误，请重试')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <LiquidGlassBackground />
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100/15 via-transparent to-orange-100/20 z-0" />

      <div className="relative z-10">
        {/* Header */}
        <header className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] border-b border-gray-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] px-6 py-4 flex items-center gap-4">
          <Link href="/bom" className="text-gray-500 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-800">新建采购清单</h1>
        </header>

        {/* Content */}
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] rounded-3xl p-8 border border-gray-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)]"
          >
            {/* 项目名称 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                项目名称（可选）
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="例如：STM32开发板复刻"
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all text-gray-800"
              />
            </div>

            {/* BOM 输入 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BOM 清单内容
              </label>
              <textarea
                value={bomText}
                onChange={(e) => { setBomText(e.target.value); setError('') }}
                placeholder="输入你要采购的元器件清单，支持自然语言描述..."
                rows={12}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all resize-none text-gray-800 font-mono text-sm leading-relaxed"
              />
            </div>

            {/* 示例按钮 */}
            <button
              onClick={() => setBomText(exampleBom)}
              className="text-sm text-orange-500 hover:text-orange-600 mb-6 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              填入示例 BOM
            </button>

            {/* 提示 */}
            <div className="mb-6 bg-orange-50/80 border border-orange-200/60 rounded-xl p-4">
              <h4 className="text-sm font-medium text-orange-800 mb-2">支持的输入格式：</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>- 每行一个元器件，支持 "x数量" 或 "数量个/只" 格式</li>
                <li>- 支持自然语言描述，如 "STM32的最小系统板要两块"</li>
                <li>- AI 会自动识别元器件型号、规格、数量</li>
              </ul>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* 提交按钮 */}
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              onClick={handleParse}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-400 text-white text-lg font-bold rounded-xl shadow-[0_8px_30px_rgba(249,115,22,0.4)] hover:shadow-[0_12px_40px_rgba(249,115,22,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI 正在解析...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI 解析并搜索
                </>
              )}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
