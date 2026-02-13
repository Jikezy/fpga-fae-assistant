'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  onMenuClick: () => void
}

interface User {
  id: string
  email: string
  role: string
}

export default function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
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

    fetchUser()
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('退出登录失败:', error)
    }
  }

  return (
    <header className="naruto-glass relative z-30 flex items-center justify-between border-b border-orange-200/70 px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-xl p-2 text-orange-900 transition hover:bg-orange-100/70 active:scale-95 lg:hidden"
          aria-label="打开菜单"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <h1 className="naruto-title text-lg font-black text-orange-950 sm:text-xl">木叶 AI 作战台</h1>
          <p className="hidden text-xs text-orange-800/70 sm:block">FPGA 咨询 · BOM 采购 · 推广联动</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => router.push('/bom')}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-orange-900 transition hover:bg-orange-100/80"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          <span className="hidden sm:inline">BOM 采购</span>
        </button>

        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-orange-100/80 sm:px-3 sm:py-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-sm font-bold text-white shadow-lg ring-2 ring-orange-200">
                {user.email[0].toUpperCase()}
              </div>
              <span className="hidden text-sm font-medium text-orange-950 md:block">{user.email}</span>
              {user.role === 'admin' && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800 ring-1 ring-orange-300">
                  管理员
                </span>
              )}
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="naruto-glass absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl py-2">
                  <div className="border-b border-orange-200/70 px-4 py-2">
                    <p className="truncate text-sm font-semibold text-orange-950">{user.email}</p>
                    <p className="text-xs text-orange-800/80">{user.role === 'admin' ? '管理员' : '普通用户'}</p>
                  </div>

                  <button
                    onClick={() => {
                      router.push('/settings')
                      setShowUserMenu(false)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-orange-950 transition hover:bg-orange-100/70"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    AI 设置
                  </button>

                  {user.role === 'admin' && (
                    <button
                      onClick={() => {
                        router.push('/admin')
                        setShowUserMenu(false)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-orange-950 transition hover:bg-orange-100/70"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                      </svg>
                      管理后台
                    </button>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"
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
