/**
 * AI 服务抽象层
 * 支持 Anthropic Claude
 */

import Anthropic from '@anthropic-ai/sdk'

// AI 消息接口
export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

// AI 服务配置
export interface AIServiceConfig {
  provider: 'anthropic'
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
    // 从环境变量读取配置
    const provider = 'anthropic' as AIServiceConfig['provider']

    this.config = {
      provider,
      apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config?.baseURL || process.env.ANTHROPIC_BASE_URL || '',
      model: config?.model || process.env.ANTHROPIC_MODEL || 'claude-opus-4-6-20250514',
    }

    // 初始化 Anthropic 客户端
    if (this.config.apiKey) {
      this.anthropic = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
      })
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
   * 流式聊天（统一接口）
   */
  async streamChat(messages: AIMessage[], onChunk: StreamCallback): Promise<void> {
    try {
      await this.streamChatAnthropic(messages, onChunk)
    } catch (error) {
      console.error('Anthropic API 错误:', error)
      throw error
    }
  }

  /**
   * 检查服务是否可用
   */
  async checkHealth(): Promise<{ available: boolean; message: string }> {
    try {
      if (!this.config.apiKey) {
        return { available: false, message: '未配置 ANTHROPIC_API_KEY' }
      }
      return { available: true, message: 'Anthropic Claude 已配置' }
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
