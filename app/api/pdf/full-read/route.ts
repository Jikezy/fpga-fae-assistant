import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export const runtime = 'nodejs'
export const maxDuration = 120

const MULTIMODAL_MAX_FILE_SIZE_MB = 8

type UserAiConfigRow = {
  anthropic_api_key: string | null
  anthropic_base_url: string | null
  ai_model: string | null
  api_format: 'auto' | 'openai' | 'anthropic' | null
}

/**
 * 完整PDF阅读接口
 * 接收PDF文件，使用用户配置的AI进行完整分析
 */
export async function POST(req: NextRequest) {
  // 验证用户登录
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const question = formData.get('question') as string

    if (!file) {
      return NextResponse.json(
        { error: '未找到PDF文件' },
        { status: 400 }
      )
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: '仅支持PDF文件' },
        { status: 400 }
      )
    }

    // 获取文件大小（MB）
    const fileSizeMB = file.size / 1024 / 1024

    // 限制文件大小为32MB
    if (fileSizeMB > 32) {
      return NextResponse.json(
        { error: '文件大小超过32MB限制' },
        { status: 400 }
      )
    }

    // 估算token数量
    const estimatedPages = Math.ceil(fileSizeMB * 10)
    const estimatedInputTokens = estimatedPages * 1800
    const estimatedOutputTokens = 1500

    // 获取用户的AI配置
    const { getSql, ensureAiModelColumn } = await import('@/lib/db-schema')
    await ensureAiModelColumn()
    const sql = getSql()
    const userConfig = await sql`
      SELECT anthropic_api_key, anthropic_base_url, ai_model, api_format
      FROM users
      WHERE id = ${authResult.user.id}
    `

    const user = userConfig.length > 0
      ? (userConfig[0] as UserAiConfigRow)
      : null
    const apiKey = user?.anthropic_api_key?.trim() || ''
    const baseURL = user?.anthropic_base_url?.trim() || ''
    const model = user?.ai_model?.trim() || ''

    // BYOK：未配置则 403
    if (!apiKey || !baseURL || !model) {
      return NextResponse.json({
        error: 'AI 未配置',
        message: '请先在设置页面配置 AI 服务（Base URL、API Key、模型名称）',
        needsConfig: true,
      }, { status: 403 })
    }

    // 读取PDF文件内容
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 调用AI服务
    const { AIService } = await import('@/lib/ai-service')
    const aiService = new AIService({
      apiKey,
      baseURL,
      model,
      format: user?.api_format || 'auto',
    })
    const {
      answerPdfQuestionWithDoubao,
      isDoubaoMultimodalModel,
    } = await import('@/lib/pdf-multimodal')

    // 创建流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送费用信息
          const costInfo = JSON.stringify({
            type: 'cost_estimate',
            estimatedPages,
            estimatedInputTokens,
            estimatedOutputTokens,
            totalCost: '0.00',
          })
          controller.enqueue(encoder.encode(`data: ${costInfo}\n\n`))

          const userQuestion = question || '请详细分析这个PDF文档的内容，包括主要主题、关键信息和技术细节。'

          const useDoubaoMultimodal =
            fileSizeMB <= MULTIMODAL_MAX_FILE_SIZE_MB &&
            isDoubaoMultimodalModel(model, baseURL)

          if (useDoubaoMultimodal) {
            const answer = await answerPdfQuestionWithDoubao(buffer, file.name, userQuestion, {
              apiKey,
              baseURL,
              model,
            })

            if (answer) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'mode',
                mode: 'doubao-multimodal',
              })}\n\n`))
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'content',
                content: answer,
              })}\n\n`))
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            }
          }

          // 提取PDF文本内容（兜底：当多模态不可用时）
          const { processPDF } = await import('@/lib/pdfProcessor')
          const processed = await processPDF(buffer, file.name)
          const fullContent = processed.documents
            .map(doc => `[第${doc.metadata.page}页]\n${doc.content}`)
            .join('\n\n')

          await aiService.streamChat([
            {
              role: 'user' as const,
              content: `我上传了一个PDF文档（${file.name}，共${processed.totalPages}页）。以下是完整内容：\n\n${fullContent}\n\n问题：${userQuestion}`,
            },
          ], (chunk) => {
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
