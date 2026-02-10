'use client'

import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'
import PageTransition from '@/components/PageTransition'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fullReadRequest, setFullReadRequest] = useState<string | null>(null)

  return (
    <PageTransition transitionKey="home">
      <div className="flex h-screen relative overflow-hidden">
        {/* 3D Liquid Glass Background */}
        <LiquidGlassBackground />

        {/* Subtle gradient overlay for better contrast */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100/15 via-transparent to-gray-100/15 z-0" />

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
          />

          {/* 聊天界面 */}
          <main className="flex-1 overflow-hidden">
            <ChatInterface
              fullReadRequest={fullReadRequest}
              onFullReadComplete={() => setFullReadRequest(null)}
            />
          </main>
        </div>
      </div>
    </PageTransition>
  )
}
