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
    // 1. 添加新字段到 users 表（如果不存在）
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT,
      ADD COLUMN IF NOT EXISTS anthropic_base_url TEXT
    `

    // 2. 添加 user_id 字段到 documents 表（如果不存在）
    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE
    `

    // 3. 添加 user_id 字段到 embeddings 表（如果不存在）
    await sql`
      ALTER TABLE embeddings
      ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE
    `

    // 4. 添加 ai_model 字段（BYOK 改造）
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_model TEXT
    `

    // 5. 创建索引以提高查询性能
    await sql`
      CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON embeddings(user_id)
    `

    return NextResponse.json({
      success: true,
      message: '数据库迁移成功：已添加用户API配置字段和文档用户隔离字段',
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
