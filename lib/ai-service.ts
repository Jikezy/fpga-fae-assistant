/**
 * AI 服务抽象层
 * BYOK（自带 Key）— 自动检测 OpenAI / Anthropic 格式
 */

// AI 消息接口
export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

// AI 服务配置（BYOK：三个必填字段 + 可选格式）
export interface AIServiceConfig {
  apiKey: string
  baseURL: string
  model: string
  format?: 'auto' | 'openai' | 'anthropic'
}

// 流式响应回调
export type StreamCallback = (chunk: string) => void

interface OpenAiStreamPayload {
  choices?: Array<{
    delta?: {
      content?: string
    }
  }>
}

interface AnthropicStreamPayload {
  type?: string
  delta?: {
    text?: string
  }
}

// 90 秒超时（留出 AI 思考时间）
const FETCH_TIMEOUT = 90000

/**
 * AI 服务类（自动检测 OpenAI / Anthropic 格式）
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
    return ''
  }

  private isArkResponsesMode(): boolean {
    const base = this.config.baseURL.trim().toLowerCase()
    const model = this.config.model.trim().toLowerCase()
    const isArkBase = base.includes('volces.com') || base.includes('ark.cn-')
    const isEndpointId = model.startsWith('ep-')

    return isArkBase && !isEndpointId
  }

  private getArkModelCandidates(): string[] {
    const rawModel = this.config.model.trim()
    const candidates: string[] = []
    const pushUnique = (value: string) => {
      const normalized = value.trim()
      if (!normalized) return
      if (!candidates.some(item => item.toLowerCase() === normalized.toLowerCase())) {
        candidates.push(normalized)
      }
    }

    pushUnique(rawModel)

    const dottedLegacy = /^doubao-seed-2\.0-pro$/i
    if (dottedLegacy.test(rawModel)) {
      pushUnique('doubao-seed-2-0-pro-260215')
    }

    if (rawModel.includes('.')) {
      pushUnique(rawModel.replace(/\./g, '-'))
    }

    return candidates
  }

  /**
   * 带超时的 fetch
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      return response
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const err = new Error(`AI API 请求超时（${FETCH_TIMEOUT / 1000}秒），请检查 Base URL 是否正确`) as Error & { isTimeout: boolean }
        err.isTimeout = true
        throw err
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * 流式聊天（OpenAI 兼容格式）
   */
  private async streamChatOpenAI(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    const systemPrompt = this.getSystemPrompt().trim()
    const requestMessages = systemPrompt
      ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
      : messages

    const response = await this.fetchWithTimeout(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: requestMessages,
        max_tokens: 4096,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`OpenAI 格式 API 错误 (${response.status}): ${errorText}`)
    }

    await this.readSSEStream(response, (data) => {
      const payload = data as OpenAiStreamPayload
      const content = payload.choices?.[0]?.delta?.content
      if (content) onChunk(content)
    })
  }

  /**
   * 流式聊天（Anthropic 格式）
   * 同时发送 Authorization: Bearer 和 x-api-key，兼容官方 API 和代理服务
   */
  private async streamChatAnthropic(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    const systemPrompt = this.getSystemPrompt().trim()
    const requestBody: Record<string, unknown> = {
      model: this.config.model,
      messages: messages,
      max_tokens: 4096,
      stream: true,
    }

    if (systemPrompt) {
      requestBody.system = systemPrompt
    }

    const response = await this.fetchWithTimeout(`${this.config.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'claude-code-20250219',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Anthropic 格式 API 错误 (${response.status}): ${errorText}`)
    }

    await this.readSSEStream(response, (data) => {
      // Anthropic 流式增量格式：event=content_block_delta，正文在 delta.text
      const payload = data as AnthropicStreamPayload
      if (payload.type === 'content_block_delta' && payload.delta?.text) {
        onChunk(payload.delta.text)
      }
    })
  }

  private extractResponsesText(payload: unknown): string {
    const texts: string[] = []

    const pushText = (value: unknown) => {
      if (typeof value === 'string' && value.trim()) {
        texts.push(value.trim())
      }
    }

    if (!payload || typeof payload !== 'object') {
      return ''
    }

    const root = payload as Record<string, unknown>
    pushText(root.output_text)

    const output = Array.isArray(root.output) ? root.output : []
    for (const item of output) {
      if (!item || typeof item !== 'object') continue
      const outputItem = item as Record<string, unknown>
      pushText(outputItem.text)

      const content = Array.isArray(outputItem.content) ? outputItem.content : []
      for (const block of content) {
        if (!block || typeof block !== 'object') continue
        const contentBlock = block as Record<string, unknown>
        pushText(contentBlock.text)
      }
    }

    return texts.join('\n').trim()
  }

  private async streamChatArkResponses(
    messages: AIMessage[],
    onChunk: StreamCallback
  ): Promise<void> {
    const conversation = messages
      .map((message) => `${message.role === 'user' ? '用户' : '助手'}：${message.content}`)
      .join('\n\n')
      .trim()

    const prompt = conversation || '请直接回复用户。'
    const modelCandidates = this.getArkModelCandidates()
    let lastError = ''

    for (const modelCandidate of modelCandidates) {
      const response = await this.fetchWithTimeout(`${this.config.baseURL}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: modelCandidate,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: prompt,
                },
              ],
            },
          ],
          temperature: 0.2,
          max_output_tokens: 4096,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        lastError = `Ark Responses API 错误 (${response.status}): ${errorText}`
        const modelNotFound = response.status === 404 && /InvalidEndpointOrModel\.NotFound/i.test(errorText)
        if (modelNotFound) {
          continue
        }
        throw new Error(lastError)
      }

      const payload = await response.json()
      const outputText = this.extractResponsesText(payload)

      if (!outputText) {
        lastError = 'Ark Responses API 返回为空'
        continue
      }

      onChunk(outputText)
      return
    }

    throw new Error(lastError || 'Ark Responses API 调用失败')
  }

  /**
   * 通用 SSE 流读取
   */
  private async readSSEStream(
    response: Response,
    onData: (parsed: unknown) => void
  ): Promise<void> {
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
          onData(parsed)
        } catch {
          // 容错策略：忽略单行坏 JSON，继续消费后续 SSE 数据
        }
      }
    }
  }

  /**
   * 流式聊天
   * format='openai'  → 直接用 OpenAI 格式
   * format='anthropic' → 直接用 Anthropic 格式
   * format='auto'/undefined → 先试 OpenAI，失败回退 Anthropic
   */
  async streamChat(messages: AIMessage[], onChunk: StreamCallback): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('API Key 未配置')
    }

    const format = this.config.format || 'auto'
    const preferArkResponses = this.isArkResponsesMode()

    if (format === 'openai') {
      if (preferArkResponses) {
        await this.streamChatArkResponses(messages, onChunk)
        return
      }
      await this.streamChatOpenAI(messages, onChunk)
      return
    }

    if (format === 'anthropic') {
      await this.streamChatAnthropic(messages, onChunk)
      return
    }

    // `auto` 模式：先走 OpenAI 兼容协议，失败后再降级
    try {
      if (preferArkResponses) {
        await this.streamChatArkResponses(messages, onChunk)
        return
      }
      await this.streamChatOpenAI(messages, onChunk)
      return
    } catch (openaiError) {
      // 超时错误不再重试（重试只会再等一倍时间，意义不大）
      if (openaiError instanceof Error && (openaiError as Error & { isTimeout?: boolean }).isTimeout) {
        throw openaiError
      }
      const msg = openaiError instanceof Error ? openaiError.message : ''
      console.log(`OpenAI 格式失败 (${msg})，尝试 Anthropic 原生格式...`)
    }

    // 降级路径：OpenAI 兼容失败后切换 Anthropic 原生协议
    await this.streamChatAnthropic(messages, onChunk)
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
