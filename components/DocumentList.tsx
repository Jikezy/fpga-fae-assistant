'use client'

import { useState, useEffect } from 'react'

interface DocumentInfo {
  filename: string
  chunks: number
}

export default function DocumentList() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  // 加载文档列表
  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/documents')
      const data = await response.json()
      if (data.success) {
        setDocuments(data.documents)
      }
    } catch (error) {
      console.error('加载文档列表失败:', error)
    } finally {
      setLoading(false)
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

    setDeleting(true)
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
      setDeleting(false)
    }
  }

  // 清空所有文档
  const clearAll = async () => {
    if (documents.length === 0) return

    if (!confirm(`确定要清空所有 ${documents.length} 个文档吗？此操作不可恢复！`)) return

    setDeleting(true)
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
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-12 h-12 mx-auto text-gray-300 mb-3"
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
        <p className="text-sm text-gray-500">暂无文档</p>
        <p className="text-xs text-gray-400 mt-1">上传PDF文档以开始使用</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors">
          <input
            type="checkbox"
            checked={selectedDocs.size === documents.length && documents.length > 0}
            onChange={toggleSelectAll}
            className="w-3.5 h-3.5 rounded border-gray-300"
          />
          <span className="text-gray-600">
            全选 ({selectedDocs.size}/{documents.length})
          </span>
        </label>

        <div className="flex gap-2">
          {selectedDocs.size > 0 && (
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              删除 ({selectedDocs.size})
            </button>
          )}
          <button
            onClick={clearAll}
            disabled={deleting}
            className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            清空全部
          </button>
        </div>
      </div>

      {/* 文档列表 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {documents.map((doc) => (
          <div
            key={doc.filename}
            className={`
              flex items-center gap-2 p-2.5 rounded-lg border transition-all cursor-pointer
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
              className="w-3.5 h-3.5 rounded border-gray-300 flex-shrink-0"
            />
            <svg
              className="w-6 h-6 text-red-500 flex-shrink-0"
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
              <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
              <p className="text-xs text-gray-500">{doc.chunks} 个片段</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
