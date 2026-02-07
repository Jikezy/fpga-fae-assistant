import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { getSql } from '@/lib/db-schema'

export const runtime = 'nodejs'

/**
 * 获取所有用户列表（仅管理员）
 */
export async function GET(req: NextRequest) {
  // 验证管理员权限
  const authResult = await requireAdmin(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const sql = getSql()

    const users = await sql`
      SELECT id, email, role, created_at
      FROM users
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      success: true,
      users: users.map((user: any) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      })),
    })
  } catch (error) {
    console.error('获取用户列表失败:', error)
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    )
  }
}

/**
 * 更新用户权限（仅管理员）
 */
export async function PATCH(req: NextRequest) {
  // 验证管理员权限
  const authResult = await requireAdmin(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const { userId, role } = await req.json()

    if (!userId || !role) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    if (role !== 'admin' && role !== 'user') {
      return NextResponse.json(
        { error: '无效的角色' },
        { status: 400 }
      )
    }

    const sql = getSql()

    // 不允许修改自己的权限
    if (userId === authResult.user.id) {
      return NextResponse.json(
        { error: '不能修改自己的权限' },
        { status: 400 }
      )
    }

    const result = await sql`
      UPDATE users
      SET role = ${role}
      WHERE id = ${userId}
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
      user: {
        id: result[0].id,
        email: result[0].email,
        role: result[0].role,
      },
    })
  } catch (error) {
    console.error('更新用户权限失败:', error)
    return NextResponse.json(
      { error: '更新用户权限失败' },
      { status: 500 }
    )
  }
}

/**
 * 删除用户（仅管理员）
 */
export async function DELETE(req: NextRequest) {
  // 验证管理员权限
  const authResult = await requireAdmin(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json(
        { error: '缺少用户ID' },
        { status: 400 }
      )
    }

    // 不允许删除自己
    if (userId === authResult.user.id) {
      return NextResponse.json(
        { error: '不能删除自己' },
        { status: 400 }
      )
    }

    const sql = getSql()

    await sql`
      DELETE FROM users
      WHERE id = ${userId}
    `

    return NextResponse.json({
      success: true,
      message: '用户已删除',
    })
  } catch (error) {
    console.error('删除用户失败:', error)
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    )
  }
}
