import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, verifyPassword, createSession } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // 频率限制：同一 IP 15分钟内最多 10 次登录尝试
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { limited, retryAfterMs } = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
    if (limited) {
      return NextResponse.json(
        { error: `登录尝试过于频繁，请 ${Math.ceil(retryAfterMs / 60000)} 分钟后重试` },
        { status: 429 }
      )
    }

    const { email, password } = await req.json()

    // 验证输入
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      )
    }

    // 查找用户
    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      )
    }

    // 验证密码（bcrypt，兼容旧 SHA-256 自动升级）
    if (!await verifyPassword(password, user.password_hash, user.id)) {
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      )
    }

    // 创建会话
    const { token, expiresAt } = await createSession(user.id)

    // 设置cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    })

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('登录失败:', error)
    return NextResponse.json(
      { error: '登录失败，请稍后重试' },
      { status: 500 }
    )
  }
}
