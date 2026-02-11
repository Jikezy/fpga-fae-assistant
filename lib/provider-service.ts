/**
 * 供应商路由器 — 请求转发 + 故障切换
 */

import { AIProvider, updateHealthStatus, markProviderUsed, logProxyRequest } from './provider-db'
import {
  openaiToAnthropic,
  anthropicToOpenai,
  detectFormat,
  convertOpenAIChunkToAnthropic,
  convertAnthropicEventToOpenAI,
} from './format-converter'

const FETCH_TIMEOUT = 30000
const FAILURE_THRESHOLD = 5

interface ProxyRequestOptions {
  body: any
  incomingFormat: 'openai' | 'anthropic'
  userId: string
}

export class ProviderRouter {
  private providers: AIProvider[]

  constructor(providers: AIProvider[]) {
    this.providers = providers
  }

  async proxyRequest({ body, incomingFormat, userId }: ProxyRequestOptions): Promise<Response> {
    if (this.providers.length === 0) {
      return new Response(JSON.stringify({ error: '没有可用的 AI 供应商' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let lastError: Error | null = null

    for (const provider of this.providers) {
      const startTime = Date.now()

      try {
        const result = await this.forwardToProvider(provider, body, incomingFormat)
        const latency = Date.now() - startTime

        // 成功 → 重置健康状态
        if (provider.consecutive_failures > 0) {
          await updateHealthStatus(provider.id, 'healthy', 0).catch(() => {})
        }
        await markProviderUsed(provider.id).catch(() => {})

        // 异步记录日志
        logProxyRequest({
          userId,
          providerId: provider.id,
          requestFormat: incomingFormat,
          targetFormat: result.targetFormat,
          model: body.model || provider.model,
          latencyMs: latency,
          status: 'success',
          providerName: provider.name,
        }).catch(() => {})

        return result.response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const latency = Date.now() - startTime
        const failures = provider.consecutive_failures + 1
        const status = failures >= FAILURE_THRESHOLD ? 'down' : 'degraded'

        await updateHealthStatus(provider.id, status, failures).catch(() => {})

        // 记录失败日志
        logProxyRequest({
          userId,
          providerId: provider.id,
          requestFormat: incomingFormat,
          model: body.model || provider.model,
          latencyMs: latency,
          status: 'error',
          errorMessage: lastError.message,
          providerName: provider.name,
        }).catch(() => {})

        console.log(`供应商 ${provider.name} 失败 (${failures}次)，尝试下一个...`)
        continue
      }
    }

    return new Response(JSON.stringify({
      error: '所有供应商均不可用',
      detail: lastError?.message,
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private async forwardToProvider(
    provider: AIProvider,
    body: any,
    incomingFormat: 'openai' | 'anthropic'
  ): Promise<{ response: Response; targetFormat: string }> {
    // 确定目标格式
    let targetFormat: 'openai' | 'anthropic'
    if (provider.api_format === 'auto') {
      targetFormat = detectFormat(provider.base_url, provider.model)
    } else {
      targetFormat = provider.api_format as 'openai' | 'anthropic'
    }

    // 转换请求体
    let convertedBody = { ...body, model: body.model || provider.model }
    if (incomingFormat !== targetFormat) {
      if (incomingFormat === 'openai' && targetFormat === 'anthropic') {
        convertedBody = openaiToAnthropic(convertedBody)
        convertedBody.model = convertedBody.model || provider.model
      } else if (incomingFormat === 'anthropic' && targetFormat === 'openai') {
        convertedBody = anthropicToOpenai(convertedBody)
        convertedBody.model = convertedBody.model || provider.model
      }
    }
    // 确保使用供应商的 model（如果请求没指定）
    if (!convertedBody.model) {
      convertedBody.model = provider.model
    }

    // 构建 URL + headers
    let url: string
    let headers: Record<string, string>

    if (targetFormat === 'anthropic') {
      url = `${provider.base_url}/messages`
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`,
        'x-api-key': provider.api_key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'claude-code-20250219',
      }
    } else {
      url = `${provider.base_url}/chat/completions`
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`,
      }
    }

    // 发送请求
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    let upstreamResponse: globalThis.Response
    try {
      upstreamResponse = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(convertedBody),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`供应商 ${provider.name} 请求超时`)
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => '')
      throw new Error(`供应商 ${provider.name} 返回错误 (${upstreamResponse.status}): ${errorText.substring(0, 200)}`)
    }

    // 如果格式相同，直接透传
    if (incomingFormat === targetFormat) {
      return {
        response: new Response(upstreamResponse.body, {
          status: 200,
          headers: {
            'Content-Type': upstreamResponse.headers.get('content-type') || 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }),
        targetFormat,
      }
    }

    // 格式不同，转换流
    const transformedStream = this.createTransformStream(
      upstreamResponse,
      incomingFormat,
      targetFormat,
      convertedBody.model || provider.model
    )

    return {
      response: new Response(transformedStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }),
      targetFormat,
    }
  }

  private createTransformStream(
    upstreamResponse: globalThis.Response,
    incomingFormat: 'openai' | 'anthropic',
    targetFormat: 'openai' | 'anthropic',
    model: string
  ): ReadableStream {
    const reader = upstreamResponse.body?.getReader()
    if (!reader) throw new Error('无法读取上游响应流')

    const decoder = new TextDecoder()
    const encoder = new TextEncoder()

    return new ReadableStream({
      async pull(controller) {
        let buffer = ''

        const processBuffer = () => {
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            if (trimmed === 'data: [DONE]') {
              if (incomingFormat === 'anthropic') {
                // 来源 OpenAI → 客户端期望 Anthropic，[DONE] 不需要转换
              } else {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              }
              continue
            }

            if (trimmed.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6))
                if (targetFormat === 'openai' && incomingFormat === 'anthropic') {
                  // 上游 Anthropic → 客户端 OpenAI
                  const converted = convertAnthropicEventToOpenAI(parsed, model)
                  if (converted) controller.enqueue(encoder.encode(converted))
                } else if (targetFormat === 'anthropic' && incomingFormat === 'openai') {
                  // 上游 OpenAI → 客户端 Anthropic
                  const events = convertOpenAIChunkToAnthropic(parsed)
                  for (const ev of events) controller.enqueue(encoder.encode(ev))
                }
              } catch {
                // skip malformed JSON
              }
            } else if (trimmed.startsWith('event: ')) {
              // Anthropic SSE events — the next data line will carry the payload
              // Just pass through for Anthropic format detection
            }
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            if (buffer.trim()) {
              buffer += '\n'
              processBuffer()
            }
            controller.close()
            return
          }
          buffer += decoder.decode(value, { stream: true })
          processBuffer()
        }
      },
    })
  }
}
