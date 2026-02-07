import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db-schema'
import { createUser } from '@/lib/auth'
import { initializeDatabase } from '@/lib/db-schema'

export const runtime = 'nodejs'

/**
 * 初始化管理员账号
 * 仅在数据库中没有用户时才能创建
 */
export async function POST() {
  try {
    // 初始化数据库
    await initializeDatabase()

    const sql = getSql()

    // 检查是否已有用户
    const users = await sql`SELECT COUNT(*) as count FROM users`
    const userCount = Number(users[0].count)

    if (userCount > 0) {
      return NextResponse.json(
        { error: '已存在用户，无法初始化管理员' },
        { status: 400 }
      )
    }

    // 创建管理员账号
    // 默认账号：admin@fpga.com
    // 默认密码：admin123
    const admin = await createUser('admin@fpga.com', 'admin123', 'admin')

    return NextResponse.json({
      success: true,
      message: '管理员账号创建成功',
      admin: {
        email: admin.email,
        defaultPassword: 'admin123',
        warning: '请立即登录并修改密码！',
      },
    })
  } catch (error) {
    console.error('初始化管理员失败:', error)
    return NextResponse.json(
      { error: '初始化失败' },
      { status: 500 }
    )
  }
}
