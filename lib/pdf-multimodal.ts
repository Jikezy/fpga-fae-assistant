import { createHash } from 'crypto'
import type { Document } from './simpleVectorStore'

const RESPONSES_TIMEOUT_MS = 80000
const DIGEST_CHUNK_SIZE = 1100
const DIGEST_CHUNK_OVERLAP = 180

type JsonRecord = Record<string, unknown>

export interface MultimodalConfig {
  apiKey: string
  baseURL: string
  model: string
}

const DIGEST_PROMPT = `You are an electronics datasheet analyst.
Read the uploaded PDF carefully and output a dense, faithful markdown digest in Simplified Chinese.

Hard requirements:
1. Keep important part numbers, package names, voltages, frequencies, timing values and register names exactly as in the document.
2. Include page references in square brackets, for example [p12].
3. Prefer concise bullet points and small tables.
4. If an item is not found, write "未在文档中找到".

Output structure:
- 文档概览
- 关键电气参数
- 时序与接口要点
- 引脚/封装注意事项
- 设计与调试建议
- 易错点与风险清单
`

function normalizeBaseURL(baseURL: string): string {
  return baseURL.trim().replace(/\/+$/, '')
}

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as JsonRecord
}

function collectTextFromContent(content: unknown, collector: string[]) {
  if (typeof content === 'string') {
    collector.push(content)
    return
  }

  if (!Array.isArray(content)) return

  for (const block of content) {
    const blockRecord = asRecord(block)
    if (!blockRecord) continue

    if (typeof blockRecord.text === 'string') {
      collector.push(blockRecord.text)
    }
  }
}

function extractResponsesText(payload: unknown): string {
  const root = asRecord(payload)
  if (!root) return ''

  const parts: string[] = []

  if (typeof root.output_text === 'string') {
    parts.push(root.output_text)
  }

  if (Array.isArray(root.output)) {
    for (const outputItem of root.output) {
      const item = asRecord(outputItem)
      if (!item) continue

      if (typeof item.text === 'string') {
        parts.push(item.text)
      }

      collectTextFromContent(item.content, parts)
    }
  }

  if (Array.isArray(root.choices)) {
    for (const choiceItem of root.choices) {
      const choice = asRecord(choiceItem)
      if (!choice) continue

      const message = asRecord(choice.message)
      if (!message) continue

      collectTextFromContent(message.content, parts)
      if (typeof message.content === 'string') {
        parts.push(message.content)
      }
    }
  }

  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function toMultimodalConfig(config: MultimodalConfig): MultimodalConfig {
  return {
    apiKey: config.apiKey.trim(),
    baseURL: normalizeBaseURL(config.baseURL),
    model: config.model.trim(),
  }
}

export function isDoubaoMultimodalModel(model: string, baseURL: string): boolean {
  const normalizedModel = model.trim().toLowerCase()
  const normalizedBase = baseURL.trim().toLowerCase()

  const modelLooksDoubao =
    normalizedModel.includes('doubao') || normalizedModel.includes('seed')
  const endpointLooksArk =
    normalizedBase.includes('volces.com') || normalizedBase.includes('ark.cn-')

  return modelLooksDoubao && endpointLooksArk
}

type ResponsesRequestOptions = {
  buffer: Buffer
  filename: string
  prompt: string
  maxOutputTokens?: number
}

async function callResponsesWithPdf(
  config: MultimodalConfig,
  options: ResponsesRequestOptions
): Promise<string> {
  const normalizedConfig = toMultimodalConfig(config)
  const fileData = `data:application/pdf;base64,${options.buffer.toString('base64')}`

  const response = await fetch(`${normalizedConfig.baseURL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${normalizedConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: normalizedConfig.model,
      temperature: 0.1,
      max_output_tokens: options.maxOutputTokens ?? 3600,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              filename: options.filename,
              file_data: fileData,
            },
            {
              type: 'input_text',
              text: options.prompt,
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(RESPONSES_TIMEOUT_MS),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`responses API failed (${response.status}): ${errorText}`)
  }

  const payload = await response.json()
  const output = extractResponsesText(payload)

  if (!output) {
    throw new Error('responses API returned empty output')
  }

  return output
}

export async function extractPdfDigestWithDoubao(
  buffer: Buffer,
  filename: string,
  config: MultimodalConfig
): Promise<string | null> {
  if (!isDoubaoMultimodalModel(config.model, config.baseURL)) {
    return null
  }

  return callResponsesWithPdf(config, {
    buffer,
    filename,
    prompt: DIGEST_PROMPT,
    maxOutputTokens: 4200,
  })
}

export async function answerPdfQuestionWithDoubao(
  buffer: Buffer,
  filename: string,
  question: string,
  config: MultimodalConfig
): Promise<string | null> {
  if (!isDoubaoMultimodalModel(config.model, config.baseURL)) {
    return null
  }

  const prompt = `请阅读这份 PDF 数据手册并回答问题：

问题：${question}

输出要求：
1. 用简体中文回答，结构清晰。
2. 尽量引用原文参数，并标注页码（例如 [p18]）。
3. 给出结论、依据和可执行建议。`

  return callResponsesWithPdf(config, {
    buffer,
    filename,
    prompt,
    maxOutputTokens: 4600,
  })
}

export function buildMultimodalDigestDocuments(
  filename: string,
  digest: string
): Document[] {
  const normalized = digest.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const docs: Document[] = []
  const stride = DIGEST_CHUNK_SIZE - DIGEST_CHUNK_OVERLAP
  const sourceHash = createHash('sha1').update(filename).digest('hex').slice(0, 10)

  for (let index = 0, start = 0; start < normalized.length; index += 1, start += stride) {
    const chunk = normalized.slice(start, start + DIGEST_CHUNK_SIZE).trim()
    if (chunk.length < 80) continue

    docs.push({
      id: `${sourceHash}_mm_${index}`,
      content: `[Multimodal digest ${index + 1}]\n${chunk}`,
      metadata: {
        source: filename,
        title: filename,
      },
    })
  }

  return docs
}
