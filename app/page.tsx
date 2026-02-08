'use client'

import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentModel, setCurrentModel] = useState('anthropic-claude-opus-4-6')
  const [fullReadRequest, setFullReadRequest] = useState<string | null>(null)

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 relative overflow-hidden">
      {/* 水墨背景效果 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(100,116,139,0.2),transparent_50%)] z-0"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(71,85,105,0.2),transparent_50%)] z-0"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_20%,rgba(148,163,184,0.15),transparent_40%)] z-0"></div>

      {/* 侧边栏 */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onFullRead={(filename) => setFullReadRequest(filename)}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-20">
        {/* 顶部导航 */}
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          currentModel={currentModel}
          onModelChange={setCurrentModel}
        />

        {/* 聊天界面 */}
        <main className="flex-1 overflow-hidden">
          <ChatInterface
            currentModel={currentModel}
            fullReadRequest={fullReadRequest}
            onFullReadComplete={() => setFullReadRequest(null)}
          />
        </main>
      </div>
    </div>
  )
}
