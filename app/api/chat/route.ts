import { NextRequest } from 'next/server'
import { AIService } from '@/lib/ai-service'
import {
  getVectorStore,
  SearchScoredDocument,
} from '@/lib/simpleVectorStore'
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

interface BuiltEvidenceContext {
  contextText: string
  evidenceIds: Set<string>
  sourceCount: number
}

const DOC_QUERY_RE =
  /pdf|文档|资料|手册|datasheet|manual|spec|specification|上传|这份|这个文件|根据文档|第\s*\d+\s*页|页码|图\d+|表\d+/i

export const runtime = 'nodejs'
export const maxDuration = 120

function isIdentityModelQuestion(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false

  return /你是谁|你是什么模型|当前模型|你用的什么模型|model name|what model|who are you/.test(
    normalized
  )
}

function isDocumentQuestion(text: string): boolean {
  return DOC_QUERY_RE.test(text.trim())
}

function safeShortSourceName(source: string): string {
  const fileName = source.split(/[/\\]/).pop() || source
  return fileName.length > 80 ? `${fileName.slice(0, 77)}...` : fileName
}

function formatDocContext(
  relevantDocs: SearchScoredDocument[]
): BuiltEvidenceContext {
  const docsBySource = new Map<string, SearchScoredDocument[]>()
  relevantDocs.forEach((doc) => {
    const source = doc.metadata.source
    if (!docsBySource.has(source)) {
      docsBySource.set(source, [])
    }
    docsBySource.get(source)!.push(doc)
  })

  const contextParts: string[] = []
  const evidenceIds = new Set<string>()
  let sourceIndex = 1
  let evidenceIndex = 1

  docsBySource.forEach((docs, source) => {
    const shortName = safeShortSourceName(source)
    contextParts.push(
      `\n===== 文档${docsBySource.size > 1 ? sourceIndex : ''}：${shortName} =====`
    )

    docs.forEach((doc) => {
      const evidenceId = `S${evidenceIndex}`
      evidenceIds.add(evidenceId)
      const pageInfo = doc.metadata.page ? `第${doc.metadata.page}页` : '位置未知'
      const scoreInfo = Number.isFinite(doc.score)
        ? `score=${doc.score.toFixed(3)}`
        : 'score=unknown'
      const entityInfo =
        doc.matchedEntities.length > 0
          ? `命中实体=${doc.matchedEntities.slice(0, 5).join('、')}`
          : '命中实体=无'

      contextParts.push(
        `\n[${evidenceId}] 来源=${shortName} | 页码=${pageInfo} | ${scoreInfo} | ${entityInfo}\n${doc.content.trim()}\n`
      )
      evidenceIndex += 1
    })

    sourceIndex += 1
  })

  return {
    contextText: contextParts.join('\n'),
    evidenceIds,
    sourceCount: docsBySource.size,
  }
}

function buildStrictDocumentMessage(
  question: string,
  docContext: BuiltEvidenceContext
): string {
  const docCount = docContext.sourceCount
  const docCountTip =
    docCount > 1
      ? `当前命中 ${docCount} 个不同文档，请先区分来源再总结。`
      : '当前命中 1 个文档，请优先引用带页码证据。'

  return `【证据片段】以下是系统检索到的文档证据，请仅基于这些证据回答：
${docContext.contextText}

【用户问题】${question}

【硬性规则（必须遵守）】
1. 你只能基于【证据片段】作答，禁止使用外部知识或常识补全
2. 每个关键结论后都必须附带证据引用，格式为 [S数字]，例如 [S2]
3. 不允许编造页码、参数、实体名；证据没有就明确说“在已检索证据中未找到”
4. 如果证据不足，直接说明缺口，不要猜测
5. ${docCountTip}

【输出建议】
- 先写“结论”
- 再写“依据”，逐条列出并附 [S#]`
}

function splitForSse(text: string, chunkSize: number = 220): string[] {
  const normalized = text || ''
  if (!normalized) return []
  const chunks: string[] = []
  for (let i = 0; i < normalized.length; i += chunkSize) {
    chunks.push(normalized.slice(i, i + chunkSize))
  }
  return chunks
}

function validateGroundedAnswer(
  answer: string,
  allowedEvidenceIds: Set<string>
): { ok: boolean; reason?: string } {
  const trimmed = answer.trim()
  if (!trimmed) {
    return { ok: false, reason: 'empty_answer' }
  }

  const matches = [...trimmed.matchAll(/\[S(\d+)\]/g)]
  if (matches.length === 0) {
    return { ok: false, reason: 'missing_citation' }
  }

  for (const match of matches) {
    const evidenceId = `S${match[1]}`
    if (!allowedEvidenceIds.has(evidenceId)) {
      return { ok: false, reason: 'invalid_citation' }
    }
  }

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const contentLines = lines.filter((line) => /[\u4e00-\u9fa5A-Za-z0-9]/.test(line))
  if (contentLines.length === 0) {
    return { ok: false, reason: 'no_content_line' }
  }

  const citedLines = contentLines.filter((line) => /\[S\d+\]/.test(line))
  if (citedLines.length < Math.ceil(contentLines.length * 0.7)) {
    return { ok: false, reason: 'insufficient_citation_density' }
  }

  return { ok: true }
}

function buildNoEvidenceResponse(): string {
  return `在已上传文档的可检索证据中未找到足够信息，无法基于文档可靠回答当前问题。

建议你：
1. 给出更具体关键词（器件名/参数名/图号/页码）
2. 指定文档名和页码范围
3. 先问“请总结这份文档的关键参数”后再追问细节`
}

function buildValidationFallback(allowedEvidenceIds: Set<string>): string {
  const evidenceTip = [...allowedEvidenceIds]
    .slice(0, 8)
    .map((id) => `[${id}]`)
    .join(' ')
  return `我无法生成满足“仅基于证据并正确引用”的回答，因此不输出可能不可靠的结论。

请你换个更具体的问题（例如指定页码、参数名或图号）后重试。
可用证据编号示例：${evidenceTip || '暂无'}`
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
    let strictDocMode = false
    let strictEvidenceIds = new Set<string>()
    let strictDirectResponse: string | null = null

    if (lastMessage?.role === 'user' && !bypassRag) {
      try {
        const vectorStore = getVectorStore()
        await vectorStore.initialize()

        const allDocs = await vectorStore.listDocuments(authResult.user.id)
        const askAboutDocs = isDocumentQuestion(lastMessage.content)

        if (allDocs.length > 0) {
          const relevantDocs = await vectorStore.searchWithGraph(
            lastMessage.content,
            10,
            authResult.user.id
          )

          if (relevantDocs.length > 0) {
            const builtContext = formatDocContext(relevantDocs)
            strictDocMode = askAboutDocs
            strictEvidenceIds = builtContext.evidenceIds

            const enhancedUserMessage = strictDocMode
              ? buildStrictDocumentMessage(lastMessage.content, builtContext)
              : `【参考文档】以下是系统检索到的文档片段：
${builtContext.contextText}

【用户问题】${lastMessage.content}

【回答要求】
1. 优先根据证据片段回答
2. 引用时使用“根据文档第X页”`

            enhancedMessages = [
              ...messages.slice(0, -1),
              { role: 'user', content: enhancedUserMessage },
            ]
          } else if (askAboutDocs) {
            strictDocMode = true
            strictDirectResponse = buildNoEvidenceResponse()
          } else {
            const fileList = allDocs
              .map((doc) => {
                const fileName = safeShortSourceName(doc.source)
                return `- ${fileName}（${doc.chunks} 个片段）`
              })
              .join('\n')

            enhancedMessages = [
              ...messages.slice(0, -1),
              {
                role: 'user',
                content: `【文档信息】用户上传了以下文档：
${fileList}

【用户问题】${lastMessage.content}

【说明】当前没有检索到高相关证据，请提示用户提供更具体关键词。`,
              },
            ]
          }
        } else if (askAboutDocs) {
          strictDocMode = true
          strictDirectResponse = '你还没有上传文档。请先上传 PDF，再基于文档提问。'
        }
      } catch (error) {
        console.error('文档检索失败:', error)
      }
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (strictDirectResponse) {
            const data = JSON.stringify({ content: strictDirectResponse })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            return
          }

          if (strictDocMode && strictEvidenceIds.size > 0) {
            let fullAnswer = ''
            await aiService.streamChat(enhancedMessages, (chunk) => {
              fullAnswer += chunk
            })

            const validation = validateGroundedAnswer(fullAnswer, strictEvidenceIds)
            const safeAnswer = validation.ok
              ? fullAnswer
              : buildValidationFallback(strictEvidenceIds)

            splitForSse(safeAnswer).forEach((chunk) => {
              const data = JSON.stringify({ content: chunk })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            })

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            return
          }

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

