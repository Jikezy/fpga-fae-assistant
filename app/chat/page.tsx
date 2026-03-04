'use client'

import { useCallback, useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'
import PageTransition from '@/components/PageTransition'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fullReadRequest, setFullReadRequest] = useState<string | null>(null)
  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])
  const handleFullRead = useCallback((filename: string) => {
    setFullReadRequest(filename)
  }, [])
  const handleFullReadComplete = useCallback(() => {
    setFullReadRequest(null)
  }, [])

  return (
    <PageTransition transitionKey="home">
      <div className="relative flex h-screen overflow-hidden">
        <LiquidGlassBackground />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_12%_10%,rgba(148,163,184,0.2),transparent_38%),radial-gradient(circle_at_85%_12%,rgba(139,92,246,0.16),transparent_34%)]" />

        <Sidebar
          isOpen={sidebarOpen}
          onToggle={handleToggleSidebar}
          onFullRead={handleFullRead}
        />

        <div className="relative z-20 flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={handleToggleSidebar} />
          <main className="flex-1 overflow-hidden">
            <ChatInterface
              fullReadRequest={fullReadRequest}
              onFullReadComplete={handleFullReadComplete}
            />
          </main>
        </div>
      </div>
    </PageTransition>
  )
}
