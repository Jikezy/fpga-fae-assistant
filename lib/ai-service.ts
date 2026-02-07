/**
 * AI 服务抽象层
 * 支持多种 AI 后端：Anthropic Claude、Ollama 本地模型、OpenAI
 */

import Anthropic from '@anthropic-ai/sdk'

// AI 消息接口
export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

// AI 服务配置
export interface AIServiceConfig {
  provider: 'anthropic' | 'ollama' | 'openai' | 'zhipu' | 'qwen' | 'ernie' | 'spark'
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
    const provider = (process.env.AI_PROVIDER || 'ollama') as AIServiceConfig['provider']

    this.config = {
      provider,
      apiKey: this.getApiKey(provider),
      baseURL: this.getBaseURL(provider),
      model: this.getDefaultModel(provider),
      ...config,
    }

    // 初始化 Anthropic 客户端
    if (this.config.provider === 'anthropic' && this.config.apiKey) {
      this.anthropic = new Anthropic({
        apiKey: this.config.apiKey,
      })
    }
  }

  /**
   * 获取 API Key
   */
  private getApiKey(provider: string): string | undefined {
    switch (provider) {
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY
      case 'openai':
        return process.env.OPENAI_API_KEY
      case 'zhipu':
        return process.env.ZHIPU_API_KEY
      case 'qwen':
        return process.env.QWEN_API_KEY
      case 'ernie':
        return process.env.ERNIE_API_KEY
      case 'spark':
        return process.env.SPARK_API_KEY
      default:
        return undefined
    }
  }

  /**
   * 获取 Base URL
   */
  private getBaseURL(provider: string): string {
    switch (provider) {
      case 'ollama':
        return process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
      case 'zhipu':
        return 'https://open.bigmodel.cn/api/paas/v4'
      case 'qwen':
        return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      case 'ernie':
        return 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1'
      case 'spark':
        return 'https://spark-api-open.xf-yun.com/v1'
      default:
        return ''
    }
  }

  /**
   * 获取默认模型
   */
  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'anthropic':
        return process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
      case 'ollama':
        return process.env.OLLAMA_MODEL || 'llama3.1:8b'
      case 'openai':
        return process.env.OPENAI_MODEL || 'gpt-4'
      case 'zhipu':
        return process.env.ZHIPU_MODEL || 'glm-4-flash'
      case 'qwen':
        return process.env.QWEN_MODEL || 'qwen-max'
      case 'ernie':
        return process.env.ERNIE_MODEL || 'ernie-4.0-8k-preview'
      case 'spark':
        return process.env.SPARK_MODEL || 'generalv3.5'
      default:
        return 'llama3.1:8b'
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
   * 流式聊天（Ollama）
   */
  private async streamChatOllama(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    const response = await fetch(`${this.config.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          ...messages,
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API 错误: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('无法读取响应流')
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          if (data.message?.content) {
            onChunk(data.message.content)
          }
        } catch (e) {
          console.error('解析 Ollama 响应失败:', e)
        }
      }
    }
  }

  /**
   * 流式聊天（OpenAI）
   */
  private async streamChatOpenAI(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          ...messages,
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API 错误: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('无法读取响应流')
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              onChunk(content)
            }
          } catch (e) {
            console.error('解析 OpenAI 响应失败:', e)
          }
        }
      }
    }
  }

  /**
   * 流式聊天（智谱 AI）
   */
  private async streamChatZhipu(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          ...messages,
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('智谱AI错误详情:', errorText)
      throw new Error(`智谱 AI API 错误: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('无法读取响应流')
    }

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

        const data = trimmedLine.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            onChunk(content)
          }
        } catch (e) {
          // 忽略JSON解析错误，继续处理下一行
        }
      }
    }
  }

  /**
   * 流式聊天（通义千问）
   */
  private async streamChatQwen(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    // 通义千问使用OpenAI兼容格式
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          ...messages,
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('通义千问错误详情:', errorText)
      throw new Error(`通义千问 API 错误: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('无法读取响应流')
    }

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

        const data = trimmedLine.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            onChunk(content)
          }
        } catch (e) {
          // 忽略JSON解析错误
        }
      }
    }
  }

  /**
   * 流式聊天（文心一言）
   */
  private async streamChatErnie(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    const response = await fetch(`${this.config.baseURL}/wenxinworkshop/chat/completions_pro?access_token=${this.config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: this.getSystemPrompt(),
          },
          ...messages,
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`文心一言 API 错误: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('无法读取响应流')
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)

          try {
            const parsed = JSON.parse(data)
            const content = parsed.result
            if (content) {
              onChunk(content)
            }
          } catch (e) {
            console.error('解析文心一言响应失败:', e)
          }
        }
      }
    }
  }

  /**
   * 流式聊天（讯飞星火）
   */
  private async streamChatSpark(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          ...messages,
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`讯飞星火 API 错误: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('无法读取响应流')
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              onChunk(content)
            }
          } catch (e) {
            console.error('解析讯飞星火响应失败:', e)
          }
        }
      }
    }
  }

  /**
   * 流式聊天（统一接口）
   */
  async streamChat(messages: AIMessage[], onChunk: StreamCallback): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'anthropic':
          await this.streamChatAnthropic(messages, onChunk)
          break
        case 'ollama':
          await this.streamChatOllama(messages, onChunk)
          break
        case 'openai':
          await this.streamChatOpenAI(messages, onChunk)
          break
        case 'zhipu':
          await this.streamChatZhipu(messages, onChunk)
          break
        case 'qwen':
          await this.streamChatQwen(messages, onChunk)
          break
        case 'ernie':
          await this.streamChatErnie(messages, onChunk)
          break
        case 'spark':
          await this.streamChatSpark(messages, onChunk)
          break
        default:
          throw new Error(`不支持的 AI 提供商: ${this.config.provider}`)
      }
    } catch (error) {
      console.error(`${this.config.provider} API 错误:`, error)
      throw error
    }
  }

  /**
   * 检查服务是否可用
   */
  async checkHealth(): Promise<{ available: boolean; message: string }> {
    try {
      switch (this.config.provider) {
        case 'anthropic':
          if (!this.config.apiKey) {
            return { available: false, message: '未配置 ANTHROPIC_API_KEY' }
          }
          return { available: true, message: 'Anthropic Claude 已配置' }

        case 'ollama':
          const response = await fetch(`${this.config.baseURL}/api/tags`, {
            method: 'GET',
          })
          if (!response.ok) {
            return { available: false, message: 'Ollama 服务未运行' }
          }
          const data = await response.json()
          const models = data.models || []
          if (models.length === 0) {
            return { available: false, message: 'Ollama 未安装任何模型' }
          }
          return {
            available: true,
            message: `Ollama 已就绪，可用模型: ${models.map((m: any) => m.name).join(', ')}`,
          }

        case 'openai':
          if (!this.config.apiKey) {
            return { available: false, message: '未配置 OPENAI_API_KEY' }
          }
          return { available: true, message: 'OpenAI 已配置' }

        case 'zhipu':
          if (!this.config.apiKey) {
            return { available: false, message: '未配置 ZHIPU_API_KEY' }
          }
          return { available: true, message: `智谱 AI 已配置 (${this.config.model})` }

        case 'qwen':
          if (!this.config.apiKey) {
            return { available: false, message: '未配置 QWEN_API_KEY' }
          }
          return { available: true, message: `通义千问已配置 (${this.config.model})` }

        case 'ernie':
          if (!this.config.apiKey) {
            return { available: false, message: '未配置 ERNIE_API_KEY' }
          }
          return { available: true, message: `文心一言已配置 (${this.config.model})` }

        case 'spark':
          if (!this.config.apiKey) {
            return { available: false, message: '未配置 SPARK_API_KEY' }
          }
          return { available: true, message: `讯飞星火已配置 (${this.config.model})` }

        default:
          return { available: false, message: '未知的 AI 提供商' }
      }
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
