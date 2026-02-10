/**
 * AI 服务抽象层
 * BYOK（自带 Key）— 统一使用 OpenAI 兼容格式调用
 */

// AI 消息接口
export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

// AI 服务配置（BYOK：三个必填字段）
export interface AIServiceConfig {
  apiKey: string
  baseURL: string
  model: string
}

// 流式响应回调
export type StreamCallback = (chunk: string) => void

/**
 * AI 服务类（OpenAI 兼容格式）
 */
export class AIService {
  private config: AIServiceConfig

  constructor(config: AIServiceConfig) {
    this.config = config
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `你是一个专业的FPGA FAE（现场应用工程师）助手。你的职责是：

1. 回答FPGA相关的技术问题
2. 提供设计建议和最佳实践
3. 帮助调试和问题排查
4. 解释FPGA数据手册和技术文档

请用专业、清晰、友好的方式回答问题。如果涉及技术细节，请提供具体的代码示例或配置说明。`
  }

  /**
   * 流式聊天（OpenAI 兼容格式）
   */
  async streamChat(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('API Key 未配置')
    }

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          ...messages,
        ],
        max_tokens: 4096,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`AI API 错误 (${response.status}): ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) onChunk(content)
        } catch {
          // skip malformed JSON lines
        }
      }
    }
  }

  /**
   * 检查服务是否可用
   */
  async checkHealth(): Promise<{ available: boolean; message: string }> {
    if (!this.config.apiKey) {
      return { available: false, message: 'API Key 未配置' }
    }
    return { available: true, message: 'AI 服务已配置' }
  }

  /**
   * 获取当前配置信息
   */
  getConfig(): AIServiceConfig {
    return { ...this.config }
  }
}
