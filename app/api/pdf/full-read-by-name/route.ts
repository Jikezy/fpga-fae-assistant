import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getVectorStore } from '@/lib/simpleVectorStore'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * 通过文件名进行完整PDF阅读
 */
export async function POST(req: NextRequest) {
  // 验证用户登录
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const { filename, question } = await req.json()

    if (!filename) {
      return NextResponse.json(
        { error: '缺少文件名参数' },
        { status: 400 }
      )
    }

    // 从数据库获取该文件的所有文档片段
    const vectorStore = getVectorStore()
    await vectorStore.initialize()

    const { getSql } = await import('@/lib/db-schema')
    const sql = getSql()

    const documents = await sql`
      SELECT content, page
      FROM documents
      WHERE source = ${filename}
      ORDER BY page ASC
    `

    if (documents.length === 0) {
      return NextResponse.json(
        { error: '文档不存在' },
        { status: 404 }
      )
    }

    // 合并所有文档片段
    const fullContent = documents
      .map((doc: any) => `[第${doc.page}页]\n${doc.content}`)
      .join('\n\n')

    const totalPages = Math.max(...documents.map((doc: any) => doc.page || 0))

    // 估算费用
    const estimatedInputTokens = fullContent.length / 4 // 粗略估算：4字符=1token
    const estimatedOutputTokens = 1500
    const inputCost = (estimatedInputTokens / 1000000) * 18
    const outputCost = (estimatedOutputTokens / 1000000) * 90
    const totalCost = inputCost + outputCost

    // 调用Claude API
    const { AIService } = await import('@/lib/ai-service')
    const aiService = new AIService({
      provider: 'anthropic',
      model: 'claude-opus-4-6',
    })

    const userQuestion = question || '请详细分析这个PDF文档的内容，包括主要主题、关键信息和技术细节。'

    const messages = [
      {
        role: 'user' as const,
        content: `我有一个PDF文档（${filename}，共${totalPages}页）。以下是完整内容：\n\n${fullContent}\n\n问题：${userQuestion}`,
      },
    ]

    // 创建流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送费用信息
          const costInfo = JSON.stringify({
            type: 'cost_estimate',
            estimatedPages: totalPages,
            estimatedInputTokens: Math.ceil(estimatedInputTokens),
            estimatedOutputTokens,
            totalCost: totalCost.toFixed(2),
          })
          controller.enqueue(encoder.encode(`data: ${costInfo}\n\n`))

          // 流式调用AI
          await aiService.streamChat(messages, (chunk) => {
            const data = JSON.stringify({ type: 'content', content: chunk })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          })

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('完整PDF阅读失败:', error)
          const errorData = JSON.stringify({
            type: 'error',
            content: `分析失败：${error instanceof Error ? error.message : '未知错误'}`,
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('请求处理错误:', error)
    return NextResponse.json(
      { error: '请求处理失败' },
      { status: 500 }
    )
  }
}
