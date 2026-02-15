import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// 清空所有文档（仅清数据库记录，RAG 后端按用户隔离无需全清）
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    // 先获取所有文档来源，逐个从 RAG 后端删除
    const { getSql } = await import('@/lib/db-schema')
    const sql = getSql()

    const docs = await sql`
      SELECT DISTINCT source FROM documents WHERE user_id = ${authResult.user.id}
    `

    if (docs.length > 0) {
      const { getRAGClient } = await import('@/lib/ragClient')
      const ragClient = getRAGClient()

      for (const doc of docs) {
        try {
          await ragClient.delete(authResult.user.id, (doc as any).source)
        } catch (e) {
          console.error(`RAG 删除 ${(doc as any).source} 失败:`, e)
        }
      }
    }

    // 清空数据库记录
    await sql`DELETE FROM documents WHERE user_id = ${authResult.user.id}`

    return NextResponse.json({
      success: true,
      message: '已清空所有文档',
    })
  } catch (error) {
    console.error('清空文档失败:', error)
    return NextResponse.json(
      { error: '清空文档失败' },
      { status: 500 }
    )
  }
}
