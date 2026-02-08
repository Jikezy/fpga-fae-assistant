import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db-schema'

export const runtime = 'nodejs'

/**
 * 临时迁移端点 - 添加 user_id 列
 * 访问: http://localhost:3000/api/fix-database
 */
export async function GET(req: NextRequest) {
  const sql = getSql()

  try {
    console.log('开始数据库修复...')

    // 1. 添加 user_id 字段到 documents 表（如果不存在）
    console.log('添加 user_id 到 documents 表...')
    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE
    `

    // 2. 添加 user_id 字段到 embeddings 表（如果不存在）
    console.log('添加 user_id 到 embeddings 表...')
    await sql`
      ALTER TABLE embeddings
      ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE
    `

    // 3. 创建索引以提高查询性能
    console.log('创建索引...')
    await sql`
      CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON embeddings(user_id)
    `

    // 4. 检查现有数据
    const docsWithoutUser = await sql`
      SELECT COUNT(*) as count FROM documents WHERE user_id IS NULL
    `
    const embeddingsWithoutUser = await sql`
      SELECT COUNT(*) as count FROM embeddings WHERE user_id IS NULL
    `

    const docsCount = Number(docsWithoutUser[0].count)
    const embeddingsCount = Number(embeddingsWithoutUser[0].count)

    console.log('数据库修复完成')

    return NextResponse.json({
      success: true,
      message: '数据库修复成功',
      details: {
        documentsWithoutUserId: docsCount,
        embeddingsWithoutUserId: embeddingsCount,
        note: docsCount > 0 ? '建议删除孤立数据后重新上传PDF' : '没有孤立数据'
      }
    })
  } catch (error) {
    console.error('数据库修复失败:', error)
    return NextResponse.json(
      {
        error: '数据库修复失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
