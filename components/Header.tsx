'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModelSelector from './ModelSelector'

interface HeaderProps {
  onMenuClick: () => void
  currentModel: string
  onModelChange: (modelId: string) => void
}

interface User {
  id: string
  email: string
  role: string
}

export default function Header({ onMenuClick, currentModel, onModelChange }: HeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  return (
    <header className="bg-gradient-to-br from-white/15 to-white/8 backdrop-blur-[40px] backdrop-saturate-[180%] border-b border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.4)] px-6 py-4 flex items-center justify-between relative z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-white/20 transition-all backdrop-blur-sm active:scale-95 hover:shadow-lg"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          FPGA FAE助手
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <ModelSelector currentModel={currentModel} onModelChange={onModelChange} />

        {/* User Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/20 transition-all backdrop-blur-sm active:scale-95"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-700 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white/50">
                <span className="text-white text-sm font-medium drop-shadow-lg">
                  {user.email[0].toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-white font-medium hidden md:block drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{user.email}</span>
              {user.role === 'admin' && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-cyan-400/30 to-slate-600/30 backdrop-blur-sm text-white text-xs rounded-full font-semibold shadow ring-1 ring-white/30">
                  管理员
                </span>
              )}
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-gradient-to-br from-white/15 to-white/8 backdrop-blur-[40px] backdrop-saturate-[180%] border border-white/25 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.4)] z-20 py-2 overflow-hidden">
                  <div className="px-4 py-2 border-b border-white/20">
                    <p className="text-sm font-medium text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{user.email}</p>
                    <p className="text-xs text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{user.role === 'admin' ? '管理员' : '普通用户'}</p>
                  </div>
                  <button
                    onClick={() => {
                      router.push('/settings')
                      setShowUserMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/20 transition-all active:scale-95 flex items-center gap-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    API 设置
                  </button>
                  {user.role === 'admin' && (
                    <button
                      onClick={() => {
                        router.push('/admin')
                        setShowUserMenu(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/20 transition-all active:scale-95 flex items-center gap-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      管理员面板
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-red-500/20 transition-all active:scale-95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                  >
                    退出登录
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
