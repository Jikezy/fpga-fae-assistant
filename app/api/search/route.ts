import { NextRequest, NextResponse } from 'next/server'
import { getVectorStore } from '@/lib/simpleVectorStore'

export async function POST(req: NextRequest) {
  try {
    const { query, topK = 5 } = await req.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: '查询参数无效' },
        { status: 400 }
      )
    }

    const vectorStore = getVectorStore()
    await vectorStore.initialize()
    const results = await vectorStore.search(query, topK)

    return NextResponse.json({
      success: true,
      results: results.map((doc) => ({
        content: doc.content,
        source: doc.metadata.source,
        page: doc.metadata.page,
      })),
      total: results.length,
    })
  } catch (error) {
    console.error('搜索失败:', error)
    return NextResponse.json(
      { error: '搜索失败' },
      { status: 500 }
    )
  }
}
