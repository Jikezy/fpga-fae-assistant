import { NextRequest, NextResponse } from 'next/server'
import { getVectorStore } from '@/lib/simpleVectorStore'
import { requireAuth } from '@/lib/auth-middleware'

// 获取文档列表
export async function GET(req: NextRequest) {
  // 验证用户登录
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const vectorStore = getVectorStore()
    await vectorStore.initialize()

    // listDocuments() 返回包含文件名、上传时间和片段数的数组
    const documentsInfo = await vectorStore.listDocuments()

    const documents = documentsInfo.map(info => ({
      filename: info.source,
      chunks: info.chunks,
      uploadedAt: info.uploadedAt.toISOString(),
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
  // 验证用户登录
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
