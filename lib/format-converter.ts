/**
 * OpenAI ↔ Anthropic 格式双向转换
 */

// ========== 请求转换 ==========

/**
 * OpenAI 格式请求 → Anthropic 格式请求
 */
export function openaiToAnthropic(body: any): any {
  const messages = body.messages || []
  let system: string | undefined

  // 提取 system 消息
  const filtered = messages.filter((m: any) => {
    if (m.role === 'system') {
      system = (system ? system + '\n' : '') + m.content
      return false
    }
    return true
  })

  return {
    model: body.model,
    system: system || undefined,
    messages: filtered,
    max_tokens: body.max_tokens || 4096,
    stream: body.stream !== false,
    temperature: body.temperature,
    top_p: body.top_p,
  }
}

/**
 * Anthropic 格式请求 → OpenAI 格式请求
 */
export function anthropicToOpenai(body: any): any {
  const messages: any[] = []

  // system 字段 → system role message
  if (body.system) {
    messages.push({ role: 'system', content: body.system })
  }

  // 添加对话消息
  if (body.messages) {
    for (const msg of body.messages) {
      // Anthropic content 可能是数组
      let content = msg.content
      if (Array.isArray(content)) {
        content = content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('')
      }
      messages.push({ role: msg.role, content })
    }
  }

  return {
    model: body.model,
    messages,
    max_tokens: body.max_tokens || 4096,
    stream: body.stream !== false,
    temperature: body.temperature,
    top_p: body.top_p,
  }
}

// ========== 流式响应转换 ==========

/**
 * OpenAI SSE chunk → Anthropic SSE events
 */
export function convertOpenAIChunkToAnthropic(chunk: any): string[] {
  const events: string[] = []
  const delta = chunk.choices?.[0]?.delta

  if (!delta) return events

  if (delta.role === 'assistant') {
    events.push(`event: message_start\ndata: ${JSON.stringify({
      type: 'message_start',
      message: { id: chunk.id || 'msg_proxy', type: 'message', role: 'assistant', content: [], model: chunk.model, usage: { input_tokens: 0, output_tokens: 0 } },
    })}\n\n`)
    events.push(`event: content_block_start\ndata: ${JSON.stringify({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    })}\n\n`)
  }

  if (delta.content) {
    events.push(`event: content_block_delta\ndata: ${JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: delta.content },
    })}\n\n`)
  }

  if (chunk.choices?.[0]?.finish_reason) {
    events.push(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`)
    events.push(`event: message_delta\ndata: ${JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: chunk.usage?.completion_tokens || 0 },
    })}\n\n`)
    events.push(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`)
  }

  return events
}

/**
 * Anthropic SSE event → OpenAI SSE chunk
 */
export function convertAnthropicEventToOpenAI(event: any, model: string): string | null {
  if (event.type === 'content_block_delta' && event.delta?.text) {
    return `data: ${JSON.stringify({
      id: 'chatcmpl-proxy',
      object: 'chat.completion.chunk',
      model,
      choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }],
    })}\n\n`
  }

  if (event.type === 'message_start') {
    return `data: ${JSON.stringify({
      id: 'chatcmpl-proxy',
      object: 'chat.completion.chunk',
      model,
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
    })}\n\n`
  }

  if (event.type === 'message_delta' && event.delta?.stop_reason) {
    return `data: ${JSON.stringify({
      id: 'chatcmpl-proxy',
      object: 'chat.completion.chunk',
      model,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    })}\n\ndata: [DONE]\n\n`
  }

  return null
}

// ========== 格式检测 ==========

/**
 * 启发式判断 API 格式
 */
export function detectFormat(baseUrl: string, model: string): 'openai' | 'anthropic' {
  const url = baseUrl.toLowerCase()
  const m = model.toLowerCase()

  // Anthropic 官方 API
  if (url.includes('anthropic.com')) return 'anthropic'

  // 其他情况默认 OpenAI 兼容格式
  return 'openai'
}
