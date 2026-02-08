import { NextRequest } from 'next/server'
import { AIService } from '@/lib/ai-service'
import { getVectorStore } from '@/lib/simpleVectorStore'
import { requireAuth } from '@/lib/auth-middleware'

// 使用 Node.js runtime
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // 验证用户登录
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const { messages, provider, model } = await req.json()

    // 获取用户的API配置
    const { getSql } = await import('@/lib/db-schema')
    const sql = getSql()
    const userConfig = await sql`
      SELECT anthropic_api_key, anthropic_base_url, role
      FROM users
      WHERE id = ${authResult.user.id}
    `

    if (userConfig.length === 0) {
      return new Response(
        JSON.stringify({ error: '用户不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const user = userConfig[0] as any

    // 只支持 Anthropic provider
    let apiKey: string | undefined
    let baseURL: string | undefined

    // 优先使用用户配置，管理员可使用系统默认
    if (user.role !== 'admin' && !user.anthropic_api_key) {
      return new Response(
        JSON.stringify({
          error: 'API配置缺失',
          message: '请先配置您的 Anthropic API Key',
          needsConfig: true,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    apiKey = user.anthropic_api_key
    baseURL = user.anthropic_base_url || 'https://yunwu.ai'

    if (user.role === 'admin' && !apiKey) {
      apiKey = process.env.ANTHROPIC_API_KEY
      baseURL = process.env.ANTHROPIC_BASE_URL || 'https://yunwu.ai'
    }

    // 创建 AI 服务实例
    const aiService = new AIService({
      provider: provider || 'anthropic',
      model,
      apiKey,
      baseURL,
    })

    // 检查服务健康状态
    const health = await aiService.checkHealth()
    if (!health.available) {
      return new Response(
        JSON.stringify({
          error: 'AI服务不可用',
          message: health.message,
          suggestion: '请检查 Anthropic API Key 配置是否正确'
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // RAG: 检索相关文档
    let enhancedMessages = [...messages]
    const lastMessage = messages[messages.length - 1]

    if (lastMessage?.role === 'user') {
      try {
        const vectorStore = getVectorStore()
        await vectorStore.initialize()

        console.log('用户问题:', lastMessage.content)

        // 检查是否有文档（只查询当前用户的文档）
        const allDocs = await vectorStore.listDocuments(authResult.user.id)
        console.log(`用户 ${authResult.user.id} 的向量存储中共有 ${allDocs.length} 个文档文件:`, allDocs.map(d => d.source))

        if (allDocs.length === 0) {
          console.log('警告: 该用户的向量存储为空，没有可搜索的文档')
        } else {
          console.log('开始搜索文档，查询内容:', lastMessage.content)
          const relevantDocs = await vectorStore.search(lastMessage.content, 8, authResult.user.id) // 只搜索当前用户的文档
          console.log(`检索到 ${relevantDocs.length} 个相关文档片段`)

          if (relevantDocs.length > 0) {
            // 按文档来源分组
            const docsBySource = new Map<string, typeof relevantDocs>()
            relevantDocs.forEach(doc => {
              const source = doc.metadata.source
              if (!docsBySource.has(source)) {
                docsBySource.set(source, [])
              }
              docsBySource.get(source)!.push(doc)
            })

            console.log(`文档片段来自 ${docsBySource.size} 个不同的PDF文件`)

            // 构建上下文信息
            const contextParts: string[] = []
            let chunkIndex = 1

            docsBySource.forEach((docs, source) => {
              // 提取简短的文件名
              const fileName = source.split(/[/\\]/).pop() || source
              const shortName = fileName.length > 80 ? fileName.substring(0, 77) + '...' : fileName

              contextParts.push(`\n===== 文档${docsBySource.size > 1 ? chunkIndex : ''}：${shortName} =====`)

              docs.forEach((doc) => {
                const pageInfo = doc.metadata.page ? `[第${doc.metadata.page}页]` : '[位置未知]'
                contextParts.push(`\n${pageInfo}\n${doc.content.trim()}\n`)
              })

              console.log(`文档 ${shortName}: 包含 ${docs.length} 个相关片段`)
              chunkIndex++
            })

            const context = contextParts.join('\n')

            // 构建增强的用户消息（把 context 拼接到用户问题前面）
            const docCount = docsBySource.size
            const enhancedUserMessage = docCount === 1
              ? `【参考文档】用户上传了1个PDF文档，以下是相关内容：

${context}

【用户问题】${lastMessage.content}

【回答要求】
1. 基于以上PDF文档内容详细回答用户的问题
2. 引用时说"根据文档第X页"或"文档中提到"
3. 综合所有片段内容，给出完整、详细的回答`
              : `【参考文档】用户上传了${docCount}个PDF文档，以下是相关内容：

${context}

【用户问题】${lastMessage.content}

【回答要求】
1. 你看到了${docCount}个不同的文档，每个文档的内容都很重要
2. 回答时明确区分不同文档的内容，例如："第一个文档（XX）中提到..."
3. 综合所有文档的内容，给出完整、详细的回答`

            // 替换最后一条用户消息
            enhancedMessages = [
              ...messages.slice(0, -1),
              {
                role: 'user',
                content: enhancedUserMessage
              }
            ]

            console.log('已将检索到的文档添加到用户消息中')
          } else {
            // 未检索到相关内容，但告诉AI用户有哪些文档
            console.log('未找到相关文档，但会告诉AI用户有哪些文档可用')
            const fileList = allDocs.map(d => {
              const fileName = d.source.split(/[/\\]/).pop() || d.source
              return `- ${fileName} (${d.chunks}个片段)`
            }).join('\n')

            const enhancedUserMessage = `【文档信息】用户上传了${allDocs.length}个PDF文档：

${fileList}

【用户问题】${lastMessage.content}

【说明】针对当前问题，我没有找到特别相关的内容片段。请告诉用户：
1. 你已经上传了这些文档
2. 当前问题可能需要更具体的关键词，或者可以使用"完整阅读"功能来深入分析整个文档
3. 如果用户想了解文档内容，建议使用侧边栏的"完整阅读"按钮`

            enhancedMessages = [
              ...messages.slice(0, -1),
              {
                role: 'user',
                content: enhancedUserMessage
              }
            ]
          }
        }
      } catch (error) {
        console.error('文档检索失败:', error)
        // 检索失败不影响正常对话，继续使用原始消息
      }
    }

    // 创建流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 使用统一的 AI 服务接口，传递增强后的消息
          await aiService.streamChat(enhancedMessages, (chunk) => {
            const data = JSON.stringify({ content: chunk })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          })

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('AI服务错误:', error)
          const errorData = JSON.stringify({
            content: `抱歉，AI服务出现错误：${error instanceof Error ? error.message : '未知错误'}。\n\n请检查：\n1. 确保 Anthropic API Key 正确\n2. 检查网络连接\n3. 确认 API 配额是否充足`,
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
        message: error instanceof Error ? error.message : '未知错误'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
