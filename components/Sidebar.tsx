'use client'

import { useState } from 'react'
import DocumentList from './DocumentList'
import DocumentUploader from './DocumentUploader'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  onFullRead?: (filename: string) => void
}

export default function Sidebar({ isOpen, onToggle, onFullRead }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'docs'>('chat')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      {/* 移动端遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-80 bg-gray-900/40 backdrop-blur-2xl border-r border-gray-600/30 shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo区域 */}
          <div className="p-6 border-b border-gray-600/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-gray-500/50">
                <svg className="w-6 h-6 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-gray-100 drop-shadow-lg">FAE助手</h2>
                <p className="text-xs text-gray-300">AI技术顾问</p>
              </div>
            </div>
          </div>

          {/* 标签切换 */}
          <div className="flex border-b border-gray-600/30 bg-gray-800/20">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-sm font-medium transition-all active:scale-95 ${
                activeTab === 'chat'
                  ? 'text-gray-100 border-b-2 border-gray-400 bg-gray-700/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/20'
              }`}
            >
              对话历史
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`flex-1 py-3 text-sm font-medium transition-all active:scale-95 ${
                activeTab === 'docs'
                  ? 'text-gray-100 border-b-2 border-gray-400 bg-gray-700/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/20'
              }`}
            >
              文档库
            </button>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'chat' ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-400 text-center py-8">
                  暂无对话历史
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <DocumentUploader
                  onUploadSuccess={() => setRefreshKey(prev => prev + 1)}
                />
                <div className="border-t border-gray-600/30 pt-4">
                  <h3 className="text-sm font-medium text-gray-100 mb-3">已上传文档</h3>
                  <DocumentList key={refreshKey} onFullRead={onFullRead} />
                </div>
              </div>
            )}
          </div>

          {/* 底部信息 */}
          <div className="p-4 border-t border-gray-600/30 bg-gray-800/20">
            <div className="text-xs text-gray-300 space-y-1">
              <p>💡 支持的文档格式：PDF</p>
              <p>🔒 数据本地存储，安全可靠</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
