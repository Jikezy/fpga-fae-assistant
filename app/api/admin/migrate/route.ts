import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getSql } from '@/lib/db-schema'

export const runtime = 'nodejs'

/**
 * 数据库迁移接口（仅管理员可访问）
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  // 验证是否为管理员
  const sql = getSql()
  const userResult = await sql`
    SELECT role FROM users WHERE id = ${authResult.user.id}
  `

  if (userResult.length === 0 || userResult[0].role !== 'admin') {
    return NextResponse.json(
      { error: '仅管理员可执行数据库迁移' },
      { status: 403 }
    )
  }

  try {
    // 添加新字段到 users 表（如果不存在）
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT,
      ADD COLUMN IF NOT EXISTS anthropic_base_url TEXT
    `

    return NextResponse.json({
      success: true,
      message: '数据库迁移成功',
    })
  } catch (error) {
    console.error('数据库迁移失败:', error)
    return NextResponse.json(
      {
        error: '数据库迁移失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
