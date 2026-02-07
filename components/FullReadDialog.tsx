'use client'

import { useState } from 'react'

interface FullReadDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function FullReadDialog({ isOpen, onClose }: FullReadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [costEstimate, setCostEstimate] = useState<{
    estimatedPages: number
    totalCost: string
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResponse('')
      setCostEstimate(null)
    }
  }

  const handleSubmit = async () => {
    if (!file) return

    setLoading(true)
    setResponse('')
    setCostEstimate(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('question', question || '请详细分析这个PDF文档的内容')

      const res = await fetch('/api/pdf/full-read', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('请求失败')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('无法读取响应')

      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'cost_estimate') {
                setCostEstimate({
                  estimatedPages: parsed.estimatedPages,
                  totalCost: parsed.totalCost,
                })
              } else if (parsed.type === 'content') {
                fullResponse += parsed.content
                setResponse(fullResponse)
              } else if (parsed.type === 'error') {
                setResponse(parsed.content)
              }
            } catch (e) {
              console.error('解析失败:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('完整阅读失败:', error)
      setResponse('分析失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setQuestion('')
    setResponse('')
    setCostEstimate(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={handleClose}
      />

      {/* 对话框 */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* 标题栏 */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">完整PDF阅读</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 内容区 */}
          <div className="p-6 space-y-6">
            {/* 上传PDF */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择PDF文件
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  已选择：{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {/* 输入问题 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                您的问题（可选）
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="例如：这个芯片的主要特性是什么？请详细说明..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-gray-900 bg-white"
                rows={3}
              />
              <p className="mt-1 text-xs text-gray-500">
                如果不填写，将默认分析整个文档的内容
              </p>
            </div>

            {/* 费用预估 */}
            {costEstimate && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">费用预估</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>预估页数：约 {costEstimate.estimatedPages} 页</p>
                  <p className="font-bold">预估费用：¥ {costEstimate.totalCost}</p>
                </div>
              </div>
            )}

            {/* AI回答 */}
            {response && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">AI 分析结果</h3>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {response}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!file || loading}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
              >
                {loading ? '分析中...' : '开始分析'}
              </button>
              <button
                onClick={handleClose}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                关闭
              </button>
            </div>

            {/* 说明 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">💡 使用说明</h3>
              <ul className="text-xs text-yellow-700 space-y-1">
                <li>• 支持最大 32MB 的PDF文件</li>
                <li>• Claude会阅读完整PDF内容，回答更准确详细</li>
                <li>• 费用会比普通检索模式高10倍左右，但准确度大幅提升</li>
                <li>• 适合需要详细分析数据手册、技术文档的场景</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
