'use client'

import { useState, useEffect } from 'react'

interface DocumentInfo {
  filename: string
  chunks: number
  uploadedAt: string
}

interface DocumentListProps {
  onFullRead?: (filename: string) => void
}

type SortBy = 'time' | 'name' | 'chunks'
type SortOrder = 'asc' | 'desc'

export default function DocumentList({ onFullRead }: DocumentListProps = {}) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('time')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

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

  // 排序文档
  const sortedDocuments = [...documents].sort((a, b) => {
    let compareResult = 0

    if (sortBy === 'time') {
      compareResult = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    } else if (sortBy === 'name') {
      compareResult = a.filename.localeCompare(b.filename)
    } else if (sortBy === 'chunks') {
      compareResult = a.chunks - b.chunks
    }

    return sortOrder === 'asc' ? compareResult : -compareResult
  })

  // 切换排序方式
  const toggleSort = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('desc')
    }
  }

  // 格式化时间
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
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
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white"></div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-12 h-12 mx-auto text-white/30 mb-3"
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
        <p className="text-sm text-white/60">暂无文档</p>
        <p className="text-xs text-white/40 mt-1">上传PDF文档以开始使用</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 排序栏 */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400">排序:</span>
        <button
          onClick={() => toggleSort('time')}
          className={`px-2 py-1 rounded-lg transition-all backdrop-blur-sm active:scale-95 ${
            sortBy === 'time' ? 'bg-gray-700/40 text-gray-100' : 'text-gray-400 hover:bg-gray-700/30'
          }`}
        >
          时间 {sortBy === 'time' && (sortOrder === 'desc' ? '↓' : '↑')}
        </button>
        <button
          onClick={() => toggleSort('name')}
          className={`px-2 py-1 rounded-lg transition-all backdrop-blur-sm active:scale-95 ${
            sortBy === 'name' ? 'bg-gray-700/40 text-gray-100' : 'text-gray-400 hover:bg-gray-700/30'
          }`}
        >
          名称 {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
        </button>
        <button
          onClick={() => toggleSort('chunks')}
          className={`px-2 py-1 rounded-lg transition-all backdrop-blur-sm active:scale-95 ${
            sortBy === 'chunks' ? 'bg-gray-700/40 text-gray-100' : 'text-gray-400 hover:bg-gray-700/30'
          }`}
        >
          片段数 {sortBy === 'chunks' && (sortOrder === 'desc' ? '↓' : '↑')}
        </button>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 cursor-pointer hover:text-gray-200 transition-colors active:scale-95">
          <input
            type="checkbox"
            checked={selectedDocs.size === documents.length && documents.length > 0}
            onChange={toggleSelectAll}
            className="w-3.5 h-3.5 rounded border-gray-500/40"
          />
          <span className="text-gray-200">
            全选 ({selectedDocs.size}/{documents.length})
          </span>
        </label>

        <div className="flex gap-2">
          {selectedDocs.size > 0 && (
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="px-2 py-1 text-xs bg-red-900/50 backdrop-blur-sm text-gray-100 rounded-lg hover:bg-red-900/70 active:scale-95 disabled:opacity-50 transition-all shadow-lg"
            >
              删除 ({selectedDocs.size})
            </button>
          )}
          <button
            onClick={clearAll}
            disabled={deleting}
            className="px-2 py-1 text-xs bg-gray-700/30 backdrop-blur-sm text-gray-100 rounded-lg hover:bg-gray-700/50 active:scale-95 disabled:opacity-50 transition-all"
          >
            清空全部
          </button>
        </div>
      </div>

      {/* 文档列表 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sortedDocuments.map((doc) => (
          <div
            key={doc.filename}
            className="border border-gray-600/30 rounded-2xl hover:border-gray-500/50 transition-all backdrop-blur-sm overflow-hidden"
          >
            <div
              className={`
                flex items-center gap-2 p-2.5 cursor-pointer transition-all
                ${
                  selectedDocs.has(doc.filename)
                    ? 'bg-gray-700/40'
                    : 'hover:bg-gray-700/20'
                }
              `}
              onClick={() => toggleDocument(doc.filename)}
            >
              <input
                type="checkbox"
                checked={selectedDocs.has(doc.filename)}
                onChange={() => {}}
                className="w-3.5 h-3.5 rounded border-gray-500/40 flex-shrink-0"
              />
              <svg
                className="w-6 h-6 text-gray-400 flex-shrink-0"
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
                <p className="text-sm font-medium text-gray-100 truncate">{doc.filename}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{doc.chunks} 个片段</span>
                  <span>•</span>
                  <span>{formatTime(doc.uploadedAt)}</span>
                </div>
              </div>
            </div>
            {/* 完整阅读按钮 */}
            {onFullRead && (
              <div className="px-2.5 pb-2.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onFullRead(doc.filename)
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-gray-700 to-gray-800 text-gray-100 text-xs rounded-xl hover:from-gray-600 hover:to-gray-700 active:scale-95 transition-all font-medium shadow-lg ring-1 ring-gray-500/50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  完整阅读
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
