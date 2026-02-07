'use client'

import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentModel, setCurrentModel] = useState('zhipu-glm-4-flash')

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航 */}
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          currentModel={currentModel}
          onModelChange={setCurrentModel}
        />

        {/* 聊天界面 */}
        <main className="flex-1 overflow-hidden">
          <ChatInterface currentModel={currentModel} />
        </main>
      </div>
    </div>
  )
}
