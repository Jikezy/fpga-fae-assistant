import { NextRequest } from 'next/server'
import { AIService } from '@/lib/ai-service'
import { getVectorStore } from '@/lib/simpleVectorStore'

// 使用 Node.js runtime
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { messages, provider, model } = await req.json()

    // 创建 AI 服务实例，使用用户选择的模型
    const aiService = new AIService({
      provider: provider || process.env.AI_PROVIDER,
      model,
    })

    // 检查服务健康状态
    const health = await aiService.checkHealth()
    if (!health.available) {
      return new Response(
        JSON.stringify({
          error: 'AI服务不可用',
          message: health.message,
          suggestion: '请检查配置或安装 Ollama 本地模型'
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

        // 检查是否有文档
        const allDocs = await vectorStore.listDocuments()
        console.log(`向量存储中共有 ${allDocs.length} 个文档文件:`, allDocs)

        if (allDocs.length === 0) {
          console.log('警告: 向量存储为空，没有可搜索的文档')
        } else {
          console.log('开始搜索文档，查询内容:', lastMessage.content)
          const relevantDocs = await vectorStore.search(lastMessage.content, 5)
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

            // 构建上下文信息
            const contextParts: string[] = []
            docsBySource.forEach((docs, source) => {
              const fileName = source.split('/').pop() || source
              contextParts.push(`【文档：${fileName}】`)

              docs.forEach((doc, idx) => {
                console.log(`文档片段${idx + 1}: ${source}, 页码: ${doc.metadata.page || 'N/A'}`)
                const pageInfo = doc.metadata.page ? `（第${doc.metadata.page}页）` : ''
                contextParts.push(`\n片段${idx + 1}${pageInfo}：\n${doc.content}`)
              })
            })

            const context = contextParts.join('\n')

            // 在用户消息前添加系统提示，包含检索到的文档
            enhancedMessages = [
              ...messages.slice(0, -1),
              {
                role: 'system',
                content: `你是一个专业的文档助手。用户上传了PDF文档，以下是从用户上传的文档中检索到的相关内容片段：

${context}

重要提示：
1. 以上所有片段都来自用户上传的同一个PDF文档的不同部分
2. 请基于这些内容详细回答用户的问题
3. 回答时不要说"文档1、文档2"，而应该说"根据PDF的第X页"或"文档中提到"
4. 如果是概览性问题，请综合这些片段的内容进行总结`
              },
              lastMessage
            ]

            console.log('已将检索到的文档添加到上下文中')
          } else {
            console.log('未找到相关文档，将使用通用回答')
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
            content: `抱歉，AI服务出现错误：${error instanceof Error ? error.message : '未知错误'}。\n\n请检查：\n1. 如果使用 Anthropic，确保 API Key 正确\n2. 如果使用 Ollama，确保服务已启动（ollama serve）\n3. 检查网络连接`,
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
