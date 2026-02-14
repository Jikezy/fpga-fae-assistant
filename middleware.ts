import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth_token')?.value

  // 公开路径（不需要登录）
  const publicPaths = ['/login', '/register', '/landing', '/api/auth/login', '/api/auth/register']

  // 如果是公开路径，直接放行
  // 说明：登录状态下也允许访问 /login 与 /register，避免无法切换账号
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // 主页特殊处理：未登录显示着陆页，已登录跳转到聊天
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/chat', request.url))
    }
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  // 其他路径需要登录
  if (!token) {
    // 未登录，重定向到登录页
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.txt).*)',
  ],
}
