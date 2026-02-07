'use client'

import { useState, useEffect } from 'react'

interface DocumentInfo {
  filename: string
  chunks: number
}

export default function DocumentManager() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())

  // 加载文档列表
  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents')
      const data = await response.json()
      if (data.success) {
        setDocuments(data.documents)
      }
    } catch (error) {
      console.error('加载文档列表失败:', error)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  // 切换选中状态
  const toggleDocument = (filename: string) => {
    const newSelected = new Set(selectedDocs)
    if (newSelected.has(filename)) {
      newSelected.delete(filename)
    } else {
      newSelected.add(filename)
    }
    setSelectedDocs(newSelected)
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set())
    } else {
      setSelectedDocs(new Set(documents.map(d => d.filename)))
    }
  }

  // 删除选中的文档
  const deleteSelected = async () => {
    if (selectedDocs.size === 0) return

    const confirmMsg = `确定要删除选中的 ${selectedDocs.size} 个文档吗？`
    if (!confirm(confirmMsg)) return

    setLoading(true)
    try {
      const response = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: Array.from(selectedDocs) }),
      })

      const data = await response.json()
      if (data.success) {
        setSelectedDocs(new Set())
        await loadDocuments()
      } else {
        alert('删除失败：' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 清空所有文档
  const clearAll = async () => {
    if (documents.length === 0) return

    if (!confirm(`确定要清空所有 ${documents.length} 个文档吗？此操作不可恢复！`)) return

    setLoading(true)
    try {
      const response = await fetch('/api/documents/clear', {
        method: 'POST',
      })

      const data = await response.json()
      if (data.success) {
        setSelectedDocs(new Set())
        await loadDocuments()
      } else {
        alert('清空失败：' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('清空失败:', error)
      alert('清空失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p>暂无上传的文档</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedDocs.size === documents.length && documents.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              全选 ({selectedDocs.size}/{documents.length})
            </span>
          </label>
        </div>

        <div className="flex gap-2">
          {selectedDocs.size > 0 && (
            <button
              onClick={deleteSelected}
              disabled={loading}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              删除选中 ({selectedDocs.size})
            </button>
          )}
          <button
            onClick={clearAll}
            disabled={loading}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            清空所有
          </button>
        </div>
      </div>

      {/* 文档列表 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {documents.map((doc) => (
          <div
            key={doc.filename}
            className={`
              flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
              ${
                selectedDocs.has(doc.filename)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }
            `}
            onClick={() => toggleDocument(doc.filename)}
          >
            <input
              type="checkbox"
              checked={selectedDocs.has(doc.filename)}
              onChange={() => {}}
              className="w-4 h-4 rounded border-gray-300"
            />
            <svg
              className="w-8 h-8 text-red-500 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
              <p className="text-sm text-gray-500">{doc.chunks} 个文档片段</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
