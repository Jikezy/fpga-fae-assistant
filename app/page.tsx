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
    <div className="flex h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative overflow-hidden">
      {/* 动态背景效果 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(120,119,198,0.3),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(237,100,166,0.3),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_20%,rgba(139,92,246,0.3),transparent_40%)]"></div>

      {/* 侧边栏 */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onFullRead={(filename) => setFullReadRequest(filename)}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
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
