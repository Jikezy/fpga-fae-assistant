import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getVectorStore } from '@/lib/simpleVectorStore'

export const runtime = 'nodejs'
export const maxDuration = 120

interface FullReadUserConfigRow {
  anthropic_api_key: string | null
  anthropic_base_url: string | null
  ai_model: string | null
  api_format: 'auto' | 'openai' | 'anthropic' | null
}

interface DocumentContentRow {
  content: string
  page: number | null
}

/**
 * 通过文件名进行完整 PDF 阅读
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const { filename, question } = await req.json()

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: '缺少文件名参数' },
        { status: 400 }
      )
    }

    const { getSql, ensureAiModelColumn } = await import('@/lib/db-schema')
    await ensureAiModelColumn()
    const sql = getSql()

    const userConfig = await sql`
      SELECT anthropic_api_key, anthropic_base_url, ai_model, api_format
      FROM users
      WHERE id = ${authResult.user.id}
    `

    if (userConfig.length === 0) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    const user = userConfig[0] as FullReadUserConfigRow
    const apiKey = user.anthropic_api_key?.trim() || ''
    const baseURL = user.anthropic_base_url?.trim() || ''
    const model = user.ai_model?.trim() || ''

    if (!apiKey || !baseURL || !model) {
      return NextResponse.json({
        error: 'AI 未配置',
        message: '请先在设置页面配置 AI 服务（Base URL、API Key、模型名称）',
        needsConfig: true,
      }, { status: 403 })
    }

    const vectorStore = getVectorStore()
    await vectorStore.initialize()

    const documents = await sql`
      SELECT content, page
      FROM documents
      WHERE source = ${filename} AND user_id = ${authResult.user.id}
      ORDER BY page ASC NULLS LAST, created_at ASC
    `

    if (documents.length === 0) {
      return NextResponse.json(
        { error: '文档不存在或您无权访问' },
        { status: 404 }
      )
    }

    const mergedRows = documents as DocumentContentRow[]
    const fullContent = mergedRows
      .map((doc, index) => {
        const pageLabel =
          typeof doc.page === 'number' && Number.isFinite(doc.page)
            ? `第${doc.page}页`
            : `补充片段${index + 1}`
        return `[${pageLabel}]\n${doc.content}`
      })
      .join('\n\n')
      .trim()

    if (!fullContent) {
      return NextResponse.json(
        { error: '文档内容为空，无法分析' },
        { status: 400 }
      )
    }

    const pageNumbers = mergedRows
      .map(doc => doc.page)
      .filter((page): page is number => typeof page === 'number' && Number.isFinite(page) && page > 0)
    const totalPages = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 0

    const estimatedInputTokens = Math.ceil(fullContent.length / 4)
    const estimatedOutputTokens = 1500

    const { AIService } = await import('@/lib/ai-service')
    const aiService = new AIService({
      apiKey,
      baseURL,
      model,
      format: user.api_format || 'auto',
    })

    const userQuestion =
      typeof question === 'string' && question.trim()
        ? question.trim()
        : '请详细分析这个 PDF 文档的内容，包括核心主题、关键参数和工程注意点。'

    const messages = [
      {
        role: 'user' as const,
        content: `我有一个 PDF 文档（${filename}，约 ${Math.max(totalPages, 1)} 页）。以下是完整内容：\n\n${fullContent}\n\n问题：${userQuestion}`,
      },
    ]

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const costInfo = JSON.stringify({
            type: 'cost_estimate',
            estimatedPages: Math.max(totalPages, 1),
            estimatedInputTokens,
            estimatedOutputTokens,
            totalCost: '0.00',
          })
          controller.enqueue(encoder.encode(`data: ${costInfo}\n\n`))

          await aiService.streamChat(messages, (chunk) => {
            const data = JSON.stringify({ type: 'content', content: chunk })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          })

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('完整 PDF 阅读失败:', error)
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
