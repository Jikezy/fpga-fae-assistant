'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'

type InputMode = 'text' | 'file'

export default function BomUploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [bomText, setBomText] = useState('')
  const [projectName, setProjectName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const exampleBom = `STM32F103C8T6 最小系统板 x2
0805贴片电容 100nF x50
0805贴片电阻 10K x50
AMS1117-3.3 稳压模块 x5
LED发光二极管 5mm 红色 x20
杜邦线 母对母 20cm x1排
2.54mm排针 单排40P x5
USB Type-C 接口模块 x2`

  const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf']

  const handleFileSelect = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      setError('不支持的文件格式，请上传 Excel (.xlsx/.xls)、CSV 或 PDF 文件')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('文件大小不能超过 10MB')
      return
    }
    setSelectedFile(file)
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleTextParse = async () => {
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
      if (!res.ok) { setError(data.error || '解析失败'); return }
      router.push(`/bom/project/${data.project.id}`)
    } catch (err) {
      setError('网络错误，请重试')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError('请选择要上传的文件')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (projectName) formData.append('projectName', projectName)

      const res = await fetch('/api/bom/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error || '解析失败'); return }
      router.push(`/bom/project/${data.project.id}`)
    } catch (err) {
      setError('网络错误，请重试')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    if (inputMode === 'text') {
      handleTextParse()
    } else {
      handleFileUpload()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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
            className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] rounded-3xl p-4 sm:p-8 border border-gray-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)]"
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

            {/* 输入方式切换 */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setInputMode('text')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  inputMode === 'text'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                手动输入
              </button>
              <button
                onClick={() => setInputMode('file')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  inputMode === 'file'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                上传文件
              </button>
            </div>

            {/* 文本输入模式 */}
            {inputMode === 'text' && (
              <>
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
                <button
                  onClick={() => setBomText(exampleBom)}
                  className="text-sm text-orange-500 hover:text-orange-600 mb-6 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  填入示例 BOM
                </button>
              </>
            )}

            {/* 文件上传模式 */}
            {inputMode === 'file' && (
              <div className="mb-6">
                {/* 拖拽上传区域 */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-orange-400 bg-orange-50/50'
                      : selectedFile
                        ? 'border-green-300 bg-green-50/30'
                        : 'border-gray-300 bg-gray-50/50 hover:border-orange-300 hover:bg-orange-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(file)
                    }}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div>
                      <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-800 font-medium mb-1">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500 mb-3">{formatFileSize(selectedFile.size)}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFile(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="text-sm text-red-500 hover:text-red-600"
                      >
                        移除文件
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-gray-800 font-medium mb-1">拖拽文件到这里，或点击选择</p>
                      <p className="text-sm text-gray-500">支持 Excel (.xlsx/.xls)、CSV、PDF 格式，最大 10MB</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 提示信息 */}
            <div className="mb-6 bg-orange-50/80 border border-orange-200/60 rounded-xl p-4">
              <h4 className="text-sm font-medium text-orange-800 mb-2">
                {inputMode === 'text' ? '文本输入提示：' : '文件上传提示：'}
              </h4>
              <ul className="text-sm text-orange-700 space-y-1">
                {inputMode === 'text' ? (
                  <>
                    <li>- 每行一个元器件，支持 x数量 或 数量个/只 格式</li>
                    <li>- 支持自然语言描述，AI 会自动识别型号、规格、数量</li>
                  </>
                ) : (
                  <>
                    <li>- Excel: 自动识别表头（名称/型号/数量等列），支持多 Sheet</li>
                    <li>- CSV: 逗号/制表符分隔均可</li>
                    <li>- PDF: 自动提取文字内容，适合 datasheet 或采购单</li>
                    <li>- 嘉立创 EDA 导出的 BOM 表可直接上传</li>
                  </>
                )}
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
              onClick={handleSubmit}
              disabled={loading || (inputMode === 'text' && !bomText.trim()) || (inputMode === 'file' && !selectedFile)}
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
                  {inputMode === 'text' ? 'AI 解析并搜索' : 'AI 解析文件并搜索'}
                </>
              )}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
