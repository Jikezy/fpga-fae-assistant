'use client'

import { useState } from 'react'

interface DocumentUploaderProps {
  onUploadSuccess?: () => void
}

export default function DocumentUploader({ onUploadSuccess }: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('仅支持PDF文件')
      return
    }

    // 验证文件大小（10MB）
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setError('文件大小不能超过10MB')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // 模拟进度
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '上传失败')
      }

      setSuccess(`文档上传成功！共处理 ${result.data.chunks} 个文本片段`)
      onUploadSuccess?.()

      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccess(null)
        setProgress(0)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试')
      setProgress(0)
    } finally {
      setUploading(false)
      // 重置input
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={`
            block w-full py-3 px-4 border-2 border-dashed rounded-lg
            text-center cursor-pointer transition-all
            ${uploading
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
              : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
            }
          `}
        >
          <svg
            className="w-8 h-8 mx-auto mb-2 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-sm text-gray-600">
            {uploading ? '上传中...' : '点击上传PDF文档'}
          </span>
          <p className="text-xs text-gray-400 mt-1">支持最大10MB的PDF文件</p>
        </label>
      </div>

      {/* 进度条 */}
      {uploading && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 text-center">{progress}%</p>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <svg
            className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 成功提示 */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <svg
            className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
    </div>
  )
}
