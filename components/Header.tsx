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
    <header className="bg-gray-900/30 backdrop-blur-xl border-b border-gray-500/30 shadow-lg px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-700/50 transition-all backdrop-blur-sm active:scale-95 hover:shadow-lg"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent drop-shadow-lg">
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
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-700/30 transition-all backdrop-blur-sm active:scale-95"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center shadow-lg ring-2 ring-gray-500/50">
                <span className="text-white text-sm font-medium">
                  {user.email[0].toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-gray-100 font-medium hidden md:block drop-shadow">{user.email}</span>
              {user.role === 'admin' && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-gray-700 to-gray-800 text-gray-100 text-xs rounded-full font-semibold shadow ring-1 ring-gray-600">
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
                <div className="absolute right-0 mt-2 w-48 bg-gray-900/95 backdrop-blur-xl border border-gray-600/40 rounded-2xl shadow-2xl z-20 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-2 border-b border-gray-700/50">
                    <p className="text-sm font-medium text-gray-100">{user.email}</p>
                    <p className="text-xs text-gray-400">{user.role === 'admin' ? '管理员' : '普通用户'}</p>
                  </div>
                  <button
                    onClick={() => {
                      router.push('/settings')
                      setShowUserMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-800/50 transition-all active:scale-95 flex items-center gap-2"
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
                      className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-800/50 transition-all active:scale-95 flex items-center gap-2"
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
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-all active:scale-95"
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
