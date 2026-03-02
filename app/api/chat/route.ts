import { NextRequest } from 'next/server'
import { AIService } from '@/lib/ai-service'
import { getVectorStore } from '@/lib/simpleVectorStore'
import { requireAuth } from '@/lib/auth-middleware'

type ChatRequestMessage = {
  role: 'user' | 'assistant'
  content: string
}

interface ChatUserConfigRow {
  anthropic_api_key: string | null
  anthropic_base_url: string | null
  ai_model: string | null
  api_format: 'auto' | 'openai' | 'anthropic' | null
}

export const runtime = 'nodejs'
export const maxDuration = 120

function isIdentityModelQuestion(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false

  return /你是谁|你是什么模型|当前模型|你用的什么模型|model name|what model|who are you/.test(
    normalized
  )
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const body = (await req.json()) as { messages?: unknown }
    const messages = Array.isArray(body.messages)
      ? body.messages.filter(
          (message): message is ChatRequestMessage =>
            !!message &&
            typeof message === 'object' &&
            ((message as { role?: unknown }).role === 'user' ||
              (message as { role?: unknown }).role === 'assistant') &&
            typeof (message as { content?: unknown }).content === 'string'
        )
      : []

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: '消息格式错误' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { getSql, ensureAiModelColumn } = await import('@/lib/db-schema')
    const sql = getSql()
    const [, userConfig] = await Promise.all([
      ensureAiModelColumn(),
      sql`SELECT anthropic_api_key, anthropic_base_url, ai_model, api_format FROM users WHERE id = ${authResult.user.id}`,
    ])

    if (userConfig.length === 0) {
      return new Response(JSON.stringify({ error: '用户不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const user = userConfig[0] as ChatUserConfigRow
    const apiKey = user.anthropic_api_key
    const baseURL = user.anthropic_base_url
    const model = user.ai_model

    if (!apiKey || !baseURL || !model) {
      return new Response(
        JSON.stringify({
          error: 'AI 未配置',
          message: '请先在设置页面配置 AI 服务（Base URL、API Key、模型名称）',
          needsConfig: true,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const lastIncomingMessage = messages[messages.length - 1]
    const bypassRag =
      lastIncomingMessage?.role === 'user' &&
      isIdentityModelQuestion(lastIncomingMessage.content || '')

    const aiService = new AIService({
      apiKey,
      baseURL,
      model,
      format: user.api_format || 'auto',
    })

    let enhancedMessages = [...messages]
    const lastMessage = messages[messages.length - 1]

    if (lastMessage?.role === 'user' && !bypassRag) {
      try {
        const vectorStore = getVectorStore()
        await vectorStore.initialize()

        console.log('用户问题:', lastMessage.content)
        const allDocs = await vectorStore.listDocuments(authResult.user.id)
        console.log(
          `用户 ${authResult.user.id} 当前可用文档: ${allDocs.length} 个`,
          allDocs.map((doc) => doc.source)
        )

        if (allDocs.length > 0) {
          const relevantDocs = await vectorStore.searchWithGraph(
            lastMessage.content,
            8,
            authResult.user.id
          )
          console.log(`GraphRAG 命中 ${relevantDocs.length} 个片段`)

          if (relevantDocs.length > 0) {
            const docsBySource = new Map<string, typeof relevantDocs>()
            relevantDocs.forEach((doc) => {
              const source = doc.metadata.source
              if (!docsBySource.has(source)) {
                docsBySource.set(source, [])
              }
              docsBySource.get(source)!.push(doc)
            })

            const contextParts: string[] = []
            let docIndex = 1

            docsBySource.forEach((docs, source) => {
              const fileName = source.split(/[/\\]/).pop() || source
              const shortName =
                fileName.length > 80 ? `${fileName.slice(0, 77)}...` : fileName

              contextParts.push(
                `\n===== 文档${docsBySource.size > 1 ? docIndex : ''}：${shortName} =====`
              )

              docs.forEach((doc) => {
                const pageInfo = doc.metadata.page
                  ? `[第${doc.metadata.page}页]`
                  : '[位置未知]'
                const scoreInfo = Number.isFinite(doc.score)
                  ? ` [score=${doc.score.toFixed(3)}]`
                  : ''
                const entityInfo =
                  doc.matchedEntities.length > 0
                    ? `\n[命中实体] ${doc.matchedEntities
                        .slice(0, 5)
                        .join('、')}`
                    : ''

                contextParts.push(
                  `\n${pageInfo}${scoreInfo}${entityInfo}\n${doc.content.trim()}\n`
                )
              })

              console.log(`文档 ${shortName}: 使用 ${docs.length} 个片段`)
              docIndex += 1
            })

            const context = contextParts.join('\n')
            const docCount = docsBySource.size

            const enhancedUserMessage =
              docCount === 1
                ? `【参考文档】用户上传了 1 个 PDF 文档，以下是检索到的证据片段：
${context}

【用户问题】${lastMessage.content}

【回答要求】
1. 基于以上证据回答，优先引用带页码的片段
2. 引用时用“根据文档第X页”或“文档中提到”
3. 若证据不足，明确说明并给出需要补充的信息`
                : `【参考文档】用户上传了 ${docCount} 个 PDF 文档，以下是检索到的证据片段：
${context}

【用户问题】${lastMessage.content}

【回答要求】
1. 明确区分不同文档的结论来源
2. 优先使用带页码的证据，避免混淆文档
3. 综合多文档信息给出完整结论`

            enhancedMessages = [
              ...messages.slice(0, -1),
              { role: 'user', content: enhancedUserMessage },
            ]

            console.log('已注入 GraphRAG 上下文')
          } else {
            const fileList = allDocs
              .map((doc) => {
                const fileName = doc.source.split(/[/\\]/).pop() || doc.source
                return `- ${fileName} (${doc.chunks} 个片段)`
              })
              .join('\n')

            const enhancedUserMessage = `【文档信息】用户上传了 ${allDocs.length} 个 PDF 文档：
${fileList}

【用户问题】${lastMessage.content}

【说明】当前没有检索到高相关证据。请提示用户：
1. 可以补充更具体关键词
2. 可尝试“完整阅读”获取整文分析
3. 若问题涉及图表，请说明页码或图号`

            enhancedMessages = [
              ...messages.slice(0, -1),
              { role: 'user', content: enhancedUserMessage },
            ]
          }
        }
      } catch (error) {
        console.error('文档检索失败:', error)
      }
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await aiService.streamChat(enhancedMessages, (chunk) => {
            const data = JSON.stringify({ content: chunk })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          })

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('AI 服务错误:', error)
          const errorData = JSON.stringify({
            content: `抱歉，AI 服务出现错误：${
              error instanceof Error ? error.message : '未知错误'
            }\n\n请检查设置页面中的 AI 配置是否正确。`,
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
    return new Response(
      JSON.stringify({
        error: '请求处理失败',
        message: error instanceof Error ? error.message : '未知错误',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

