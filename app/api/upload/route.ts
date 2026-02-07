import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 使用 Node.js runtime 而不是 Edge runtime，因为需要处理PDF
export const runtime = 'nodejs'
// 增加超时时间到60秒
export const maxDuration = 60

export async function GET() {
  try {
    // 动态导入以避免模块加载时的初始化问题
    const { getVectorStore } = await import('@/lib/simpleVectorStore')

    const vectorStore = getVectorStore()
    await vectorStore.initialize()
    const documents = await vectorStore.listDocuments()

    const uniqueFiles = Array.from(
      new Set(documents.map((id) => id.split('_chunk_')[0]))
    )

    return NextResponse.json({
      success: true,
      documents: uniqueFiles,
      total: documents.length,
    })
  } catch (error) {
    console.error('GET /api/upload error:', error)
    return NextResponse.json({
      success: true,
      documents: [],
      total: 0,
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '未找到上传文件' },
        { status: 400 }
      )
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: '仅支持PDF文件' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const maxSizeMB = 10
    const fileSizeMB = buffer.length / 1024 / 1024
    if (fileSizeMB > maxSizeMB) {
      return NextResponse.json(
        { error: `文件大小超过限制（最大${maxSizeMB}MB）` },
        { status: 400 }
      )
    }

    // 动态导入以避免模块加载时的初始化问题
    const { processPDF } = await import('@/lib/pdfProcessor')
    const { getVectorStore } = await import('@/lib/simpleVectorStore')

    const processed = await processPDF(buffer, file.name)

    const vectorStore = getVectorStore()
    await vectorStore.initialize()
    await vectorStore.addDocuments(processed.documents)

    return NextResponse.json({
      success: true,
      message: '文档上传成功',
      data: {
        filename: file.name,
        totalPages: processed.totalPages,
        chunks: processed.documents.length,
        sizeMB: fileSizeMB.toFixed(2),
      },
    })
  } catch (error) {
    console.error('上传失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传失败' },
      { status: 500 }
    )
  }
}

