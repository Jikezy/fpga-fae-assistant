import { NextRequest, NextResponse } from 'next/server'
import { getRAGClient } from '@/lib/ragClient'
import { requireAuth } from '@/lib/auth-middleware'

// 获取文档列表
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const { getSql } = await import('@/lib/db-schema')
    const sql = getSql()
    const docs = await sql`
      SELECT source as filename,
             COUNT(*) as chunks,
             MIN(created_at) as uploaded_at
      FROM documents
      WHERE user_id = ${authResult.user.id}
      GROUP BY source
      ORDER BY MIN(created_at) DESC
    `

    const documents = docs.map((d: any) => ({
      filename: d.filename,
      chunks: Number(d.chunks),
      uploadedAt: d.uploaded_at ? new Date(d.uploaded_at).toISOString() : new Date().toISOString(),
    }))

    return NextResponse.json({
      success: true,
      documents,
      total: documents.length,
    })
  } catch (error) {
    console.error('获取文档列表失败:', error)
    return NextResponse.json(
      { error: '获取文档列表失败' },
      { status: 500 }
    )
  }
}

// 删除选中的文档
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const { filenames } = await req.json()

    if (!Array.isArray(filenames) || filenames.length === 0) {
      return NextResponse.json(
        { error: '请提供要删除的文件名列表' },
        { status: 400 }
      )
    }

    const ragClient = getRAGClient()

    let deletedCount = 0
    for (const filename of filenames) {
      // 从 RAG 后端删除
      const result = await ragClient.delete(authResult.user.id, filename)
      deletedCount += result.deleted_count

      // 从数据库删除元数据
      try {
        const { getSql } = await import('@/lib/db-schema')
        const sql = getSql()
        await sql`
          DELETE FROM documents
          WHERE source = ${filename} AND user_id = ${authResult.user.id}
        `
      } catch (dbError) {
        console.error('数据库删除失败:', dbError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功删除 ${deletedCount} 个文档片段`,
      deletedCount,
    })
  } catch (error) {
    console.error('删除文档失败:', error)
    return NextResponse.json(
      { error: '删除文档失败' },
      { status: 500 }
    )
  }
}
