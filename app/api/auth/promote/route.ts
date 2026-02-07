import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db-schema'

export const runtime = 'nodejs'

/**
 * 将用户提升为管理员
 * 仅在没有管理员的情况下可以使用
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: '缺少邮箱参数' },
        { status: 400 }
      )
    }

    const sql = getSql()

    // 检查是否已有管理员
    const admins = await sql`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`
    const adminCount = Number(admins[0].count)

    if (adminCount > 0) {
      return NextResponse.json(
        { error: '已存在管理员，无法提升权限' },
        { status: 400 }
      )
    }

    // 将指定用户提升为管理员
    const result = await sql`
      UPDATE users
      SET role = 'admin'
      WHERE email = ${email}
      RETURNING id, email, role
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '用户已提升为管理员',
      user: {
        email: result[0].email,
        role: result[0].role,
      },
    })
  } catch (error) {
    console.error('提升权限失败:', error)
    return NextResponse.json(
      { error: '提升权限失败' },
      { status: 500 }
    )
  }
}
