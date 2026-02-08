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

    // 获取用户的API配置
    const { getSql } = await import('@/lib/db-schema')
    const sql = getSql()
    const userConfig = await sql`
      SELECT anthropic_api_key, anthropic_base_url, role
      FROM users
      WHERE id = ${authResult.user.id}
    `

    if (userConfig.length === 0) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    const user = userConfig[0] as any

    // 如果是普通用户且未配置API Key，返回错误
    if (user.role !== 'admin' && !user.anthropic_api_key) {
      return NextResponse.json({
        error: 'API配置缺失',
        message: '请先在设置中配置您的云雾AI API Key',
        needsConfig: true,
      }, { status: 403 })
    }

    // 决定使用哪个API Key和Base URL
    let apiKey = user.anthropic_api_key
    let baseURL = user.anthropic_base_url || 'https://yunwu.ai'

    if (user.role === 'admin' && !apiKey) {
      apiKey = process.env.ANTHROPIC_API_KEY
      baseURL = process.env.ANTHROPIC_BASE_URL || 'https://yunwu.ai'
    }

    // 从数据库获取该文件的所有文档片段（仅当前用户的）
    const vectorStore = getVectorStore()
    await vectorStore.initialize()

    const documents = await sql`
      SELECT content, page
      FROM documents
      WHERE source = ${filename} AND user_id = ${authResult.user.id}
      ORDER BY page ASC
    `

    if (documents.length === 0) {
      return NextResponse.json(
        { error: '文档不存在或您无权访问' },
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

    // 调用AI服务（使用环境变量配置的提供商）
    const { AIService } = await import('@/lib/ai-service')
    const provider = process.env.AI_PROVIDER || 'zhipu'
    const model = process.env.ZHIPU_MODEL || process.env.ANTHROPIC_MODEL || 'glm-4-flash'

    const aiService = new AIService({
      provider,
      model,
      apiKey: provider === 'anthropic' ? apiKey : undefined,
      baseURL: provider === 'anthropic' ? baseURL : undefined,
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
