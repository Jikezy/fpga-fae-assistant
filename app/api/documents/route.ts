import { NextRequest, NextResponse } from 'next/server'
import { getVectorStore } from '@/lib/simpleVectorStore'

// 获取文档列表
export async function GET() {
  try {
    const vectorStore = getVectorStore()
    await vectorStore.initialize()

    // listDocuments() 现在直接返回文件名列表（已去重）
    const filenames = await vectorStore.listDocuments()

    // 为每个文件统计片段数量
    const documents = await Promise.all(
      filenames.map(async (filename) => {
        // 从数据库查询该文件的片段数量
        const sql = (await import('@/lib/db-schema')).getSql()
        const result = await sql`
          SELECT COUNT(*) as count
          FROM documents
          WHERE source = ${filename}
        `
        const chunks = Number(result[0]?.count || 0)

        return {
          filename,
          chunks,
        }
      })
    )

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
  try {
    const { filenames } = await req.json()

    if (!Array.isArray(filenames) || filenames.length === 0) {
      return NextResponse.json(
        { error: '请提供要删除的文件名列表' },
        { status: 400 }
      )
    }

    const vectorStore = getVectorStore()
    await vectorStore.initialize()

    let deletedCount = 0
    for (const filename of filenames) {
      const count = await vectorStore.deleteDocumentsBySource(filename)
      deletedCount += count
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
