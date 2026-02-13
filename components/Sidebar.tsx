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
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-80 transform border-r border-orange-200/70 transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="naruto-glass flex h-full flex-col rounded-r-3xl lg:rounded-none">
          <div className="border-b border-orange-200/70 px-4 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg ring-2 ring-orange-200">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="naruto-title text-lg font-bold text-orange-950">作战侧栏</h2>
                <p className="text-xs text-orange-900/75">文档管理与会话入口</p>
              </div>
            </div>
          </div>

          <div className="flex border-b border-orange-200/70 bg-orange-50/65">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                activeTab === 'chat'
                  ? 'border-b-2 border-orange-500 bg-white/85 text-orange-950'
                  : 'text-orange-800/75 hover:bg-orange-100/60 hover:text-orange-950'
              }`}
            >
              对话历史
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                activeTab === 'docs'
                  ? 'border-b-2 border-orange-500 bg-white/85 text-orange-950'
                  : 'text-orange-800/75 hover:bg-orange-100/60 hover:text-orange-950'
              }`}
            >
              文档库
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {activeTab === 'chat' ? (
              <div className="rounded-2xl border border-orange-200/70 bg-white/70 px-4 py-6 text-center text-sm text-orange-900/75">
                暂无历史会话，发送消息后会自动记录。
              </div>
            ) : (
              <div className="space-y-4">
                <DocumentUploader onUploadSuccess={() => setRefreshKey((prev) => prev + 1)} />
                <div className="border-t border-orange-200/70 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-orange-950">已上传文档</h3>
                  <DocumentList key={refreshKey} onFullRead={onFullRead} />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-orange-200/70 bg-orange-50/70 px-4 py-4">
            <div className="space-y-1 text-xs font-medium text-orange-900/85">
              <p>支持格式：PDF</p>
              <p>数据按用户隔离，支持管理员清理</p>
            </div>
            <a
              href="mailto:3082463315@qq.com"
              className="mt-2 block text-xs text-orange-700/80 transition hover:text-orange-900"
            >
              投诉举报：3082463315@qq.com
            </a>
          </div>
        </div>
      </aside>
    </>
  )
}
