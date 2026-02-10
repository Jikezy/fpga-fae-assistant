/**
 * AI 服务抽象层
 * 支持 Anthropic Claude + SiliconFlow (OpenAI 兼容)
 */

import Anthropic from '@anthropic-ai/sdk'

// AI 消息接口
export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

// AI 服务配置
export interface AIServiceConfig {
  provider: 'anthropic' | 'siliconflow'
  apiKey?: string
  baseURL?: string
  model?: string
}

// 流式响应回调
export type StreamCallback = (chunk: string) => void

/**
 * AI 服务类
 */
export class AIService {
  private config: AIServiceConfig
  private anthropic?: Anthropic

  constructor(config?: Partial<AIServiceConfig>) {
    const provider = config?.provider || 'anthropic'

    if (provider === 'siliconflow') {
      this.config = {
        provider: 'siliconflow',
        apiKey: config?.apiKey || process.env.SILICONFLOW_API_KEY,
        baseURL: config?.baseURL || 'https://api.siliconflow.cn/v1',
        model: config?.model || 'deepseek-ai/DeepSeek-V3',
      }
    } else {
      this.config = {
        provider: 'anthropic',
        apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: config?.baseURL || process.env.ANTHROPIC_BASE_URL || '',
        model: config?.model || process.env.ANTHROPIC_MODEL || 'claude-opus-4-20250514',
      }
      // 初始化 Anthropic 客户端
      if (this.config.apiKey) {
        this.anthropic = new Anthropic({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseURL,
        })
      }
    }
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
   * 流式聊天（Anthropic）
   */
  private async streamChatAnthropic(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    if (!this.anthropic) {
      throw new Error('Anthropic 客户端未初始化')
    }

    const response = await this.anthropic.messages.create({
      model: this.config.model!,
      max_tokens: 4096,
      messages: messages,
      system: this.getSystemPrompt(),
      stream: true,
    })

    for await (const event of response) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        onChunk(event.delta.text)
      }
    }
  }

  /**
   * 流式聊天（OpenAI 兼容 — SiliconFlow）
   */
  private async streamChatOpenAICompatible(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('SiliconFlow API Key 未配置')
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
      throw new Error(`SiliconFlow API 错误 (${response.status}): ${errorText}`)
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
   * 流式聊天（统一接口）
   */
  async streamChat(messages: AIMessage[], onChunk: StreamCallback): Promise<void> {
    if (this.config.provider === 'siliconflow') {
      await this.streamChatOpenAICompatible(messages, onChunk)
    } else {
      await this.streamChatAnthropic(messages, onChunk)
    }
  }

  /**
   * 检查服务是否可用
   */
  async checkHealth(): Promise<{ available: boolean; message: string }> {
    try {
      if (!this.config.apiKey) {
        const providerName = this.config.provider === 'siliconflow' ? 'SILICONFLOW_API_KEY' : 'ANTHROPIC_API_KEY'
        return { available: false, message: `未配置 ${providerName}` }
      }
      const providerLabel = this.config.provider === 'siliconflow' ? 'SiliconFlow' : 'Anthropic Claude'
      return { available: true, message: `${providerLabel} 已配置` }
    } catch (error) {
      return {
        available: false,
        message: `健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }
  }

  /**
   * 获取当前配置信息
   */
  getConfig(): AIServiceConfig {
    return { ...this.config }
  }
}

// 导出单例实例
export const aiService = new AIService()
