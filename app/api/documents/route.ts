import { NextRequest, NextResponse } from 'next/server'
import { getVectorStore } from '@/lib/simpleVectorStore'

// 获取文档列表
export async function GET() {
  try {
    const vectorStore = getVectorStore()
    await vectorStore.initialize()
    const allDocIds = await vectorStore.listDocuments()

    // 按文件名分组统计
    const fileStats = new Map<string, number>()

    for (const docId of allDocIds) {
      const filename = docId.split('_chunk_')[0]
      fileStats.set(filename, (fileStats.get(filename) || 0) + 1)
    }

    const documents = Array.from(fileStats.entries()).map(([filename, chunks]) => ({
      filename,
      chunks,
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
