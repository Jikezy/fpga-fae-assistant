import { NextResponse } from 'next/server'
import { getVectorStore } from '@/lib/simpleVectorStore'

// 清空所有文档
export async function POST() {
  try {
    const vectorStore = getVectorStore()
    await vectorStore.initialize()
    await vectorStore.deleteCollection()

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
