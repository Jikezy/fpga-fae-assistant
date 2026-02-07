import { NextRequest, NextResponse } from 'next/server'
import { validateSession, User } from './auth'

/**
 * API 认证中间件
 * 验证用户是否已登录
 */
export async function requireAuth(req: NextRequest): Promise<
  | { user: User; error: null }
  | { user: null; error: NextResponse }
> {
  const token = req.cookies.get('auth_token')?.value

  if (!token) {
    return {
      user: null,
      error: NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      ),
    }
  }

  const user = await validateSession(token)

  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: '会话已过期，请重新登录' },
        { status: 401 }
      ),
    }
  }

  return { user, error: null }
}

/**
 * 要求管理员权限
 */
export async function requireAdmin(req: NextRequest): Promise<
  | { user: User; error: null }
  | { user: null; error: NextResponse }
> {
  const authResult = await requireAuth(req)

  if (authResult.error) {
    return authResult
  }

  if (authResult.user.role !== 'admin') {
    return {
      user: null,
      error: NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      ),
    }
  }

  return authResult
}
