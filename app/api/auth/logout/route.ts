import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value

    if (token) {
      await deleteSession(token)
    }

    const response = NextResponse.json({
      success: true,
      message: '已退出登录',
    })

    // 清除cookie
    response.cookies.delete('auth_token')

    return response
  } catch (error) {
    console.error('登出失败:', error)
    return NextResponse.json(
      { error: '登出失败' },
      { status: 500 }
    )
  }
}
