/**
 * BOM 解析引擎
 * 使用 DeepSeek AI（免费）将用户输入的自然语言/文本解析为结构化元器件列表
 * DeepSeek API 兼容 OpenAI 格式
 */

export interface BomItem {
  name: string        // 元器件名称
  spec: string        // 规格型号
  quantity: number    // 数量
  searchKeyword: string // 淘宝搜索关键词
  category: string    // 分类：芯片/电容/电阻/模块/连接器/其他
}

export interface ParseResult {
  items: BomItem[]
  warnings: string[]  // 解析中的警告（如规格不明确）
  parseEngine: 'deepseek' | 'rule' // 解析引擎：deepseek AI 或规则降级
}

type BomParseConfig = {
  apiKey?: string
  baseUrl?: string
  model?: string
  backupApiKey?: string
  backupBaseUrl?: string
  chunkMode?: boolean
}

const BOM_SYSTEM_PROMPT = `You are a BOM parser for electronic components.
Return ONLY valid JSON (no markdown, no code fences, no explanation) with this schema:
{"items":[{"name":"","spec":"","quantity":1,"searchKeyword":"","category":""}],"warnings":[]}
Rules:
- Keep one item per component line.
- quantity must be integer >= 1.
- searchKeyword must be concise for ecommerce search, remove package-only tails and trailing quantity markers.
- Use Simplified Chinese for generic component terms (for example: resistor -> 电阻, capacitor -> 电容); keep model numbers and package codes unchanged.
- category must be one of: 芯片, 电容, 电阻, 电感, 二极管, 三极管, 模块, 连接器, 线材, 工具, 其他.
- If uncertain, keep best guess and add a short warning.
Output JSON only.`

const MODEL_SKIP_CACHE_TTL_MS = 30 * 60 * 1000
const modelSkipCache = new Map<string, number>()

/**
 * 使用 DeepSeek AI 解析 BOM 文本
 * 优先用用户自己的 DeepSeek 配置，回退到系统环境变量，最后降级规则解析
 */
export async function parseBomText(
  text: string,
  userConfig?: BomParseConfig
): Promise<ParseResult> {
  const userApiKey = userConfig?.apiKey?.trim()
  const envApiKey = process.env.DEEPSEEK_API_KEY?.trim()
  const userBaseUrl = normalizeBaseUrl(userConfig?.baseUrl)
  const backupApiKey = userConfig?.backupApiKey?.trim()
  const backupBaseUrl = normalizeBaseUrl(userConfig?.backupBaseUrl)
  const defaultBaseUrl = 'https://api.deepseek.com'
  const modelCandidates = buildModelCandidates(userConfig?.model, process.env.DEEPSEEK_MODEL)
  const { maxTokens, timeoutMs } = getDynamicAiBudget(text, { chunkMode: userConfig?.chunkMode === true })
  const fallbackResult = ruleBasedParse(text)

  if (!userConfig?.chunkMode) {
    const chunkedResult = await parseBomByChunks(text, userConfig)
    if (chunkedResult) {
      return chunkedResult
    }
  }

  const candidates: Array<{ apiKey: string; baseUrl: string; source: string }> = []

  if (userApiKey) {
    const primaryBaseUrl = userBaseUrl || defaultBaseUrl
    candidates.push({ apiKey: userApiKey, baseUrl: primaryBaseUrl, source: 'user' })

    if (primaryBaseUrl !== defaultBaseUrl) {
      candidates.push({ apiKey: userApiKey, baseUrl: defaultBaseUrl, source: 'user-default-base' })
    }
  }

  if (backupApiKey && backupApiKey !== userApiKey) {
    const backupPrimaryBaseUrl = backupBaseUrl || defaultBaseUrl
    candidates.push({ apiKey: backupApiKey, baseUrl: backupPrimaryBaseUrl, source: 'backup' })

    if (backupPrimaryBaseUrl !== defaultBaseUrl) {
      candidates.push({ apiKey: backupApiKey, baseUrl: defaultBaseUrl, source: 'backup-default-base' })
    }
  }

  const hasUserProvidedCandidate = candidates.length > 0
  if (!hasUserProvidedCandidate && envApiKey) {
    candidates.push({ apiKey: envApiKey, baseUrl: defaultBaseUrl, source: 'env' })
  }

  if (candidates.length === 0) {
    console.warn('DeepSeek API key missing, fallback to rule parser')
    return { ...fallbackResult, parseEngine: 'rule' }
  }

  let lastErrorReason = ''

  for (const candidate of candidates) {
    const endpoints = buildCompletionEndpointCandidates(candidate.baseUrl)
    let candidateBlocked = false

    for (const endpoint of endpoints) {
      const attemptedModels = new Set<string>()

      for (const model of modelCandidates) {
        const requestModel = normalizeModelForEndpoint(model, endpoint)
        const requestModelKey = requestModel.toLowerCase()
        if (attemptedModels.has(requestModelKey)) {
          continue
        }
        attemptedModels.add(requestModelKey)

        const modelTag = sanitizeModelName(requestModel)

        if (shouldSkipModelForEndpoint(endpoint, requestModel)) {
          lastErrorReason = `model_cached_unavailable_${candidate.source}_${modelTag}`
          continue
        }

        try {
          let requestBody = buildCompletionRequest(requestModel, text, maxTokens, true)
          let response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${candidate.apiKey}`,
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(timeoutMs),
          })

          if (!response.ok) {
            let errText = await response.text()

            if (isUnsupportedResponseFormatError(response.status, errText)) {
              requestBody = buildCompletionRequest(requestModel, text, maxTokens, false)
              response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${candidate.apiKey}`,
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(timeoutMs),
              })

              if (!response.ok) {
                errText = await response.text()
              }
            }

            if (!response.ok) {
              lastErrorReason = classifyApiFailure(response.status, errText, candidate.source, modelTag)
              console.error(
                `DeepSeek API request failed (${candidate.source}):`,
                response.status,
                `model=${requestModel}`,
                `endpoint=${endpoint}`,
                errText
              )

              if (response.status === 401 || response.status === 403) {
                candidateBlocked = true
                break
              }

              if (isModelNotSupported(response.status, errText)) {
                markModelAsUnavailable(endpoint, requestModel)
                continue
              }

              if (isLikelyEndpointMismatch(response.status, errText)) {
                break
              }

              continue
            }
          }

          const data = await response.json()
          const content = extractMessageText(data?.choices?.[0]?.message?.content)
          const finishReason = typeof data?.choices?.[0]?.finish_reason === 'string'
            ? data.choices[0].finish_reason
            : ''

          if (!content) {
            lastErrorReason = `empty_content_${candidate.source}_${modelTag}`
            console.error(`DeepSeek response content is empty (${candidate.source}, model=${requestModel})`)
            continue
          }

          const payload = extractJsonPayload(content)
          if (!payload) {
            const rescuedJsonLike = deriveItemsFromJsonLikeText(content)
            if (rescuedJsonLike.length > 0) {
              const mergedItems = maybeSupplementWithRule(rescuedJsonLike, fallbackResult.items)
              const recoveredWarnings = [`AI recovered via json-like fallback (${requestModel})`]
              if (mergedItems.length > rescuedJsonLike.length) {
                recoveredWarnings.push('AI supplemented with rule coverage')
              }
              return {
                items: mergedItems,
                warnings: recoveredWarnings,
                parseEngine: 'deepseek',
              }
            }

            const rescued = deriveItemsFromAiText(content)
            if (rescued.length > 0) {
              const mergedItems = maybeSupplementWithRule(rescued, fallbackResult.items)
              const recoveredWarnings = [`AI recovered via text fallback (${requestModel})`]
              if (mergedItems.length > rescued.length) {
                recoveredWarnings.push('AI supplemented with rule coverage')
              }
              return {
                items: mergedItems,
                warnings: recoveredWarnings,
                parseEngine: 'deepseek',
              }
            }

            lastErrorReason = finishReason === 'length'
              ? `json_extract_failed_length_${candidate.source}_${modelTag}`
              : `json_extract_failed_${candidate.source}_${modelTag}`
            console.error(`DeepSeek response does not contain valid JSON (${candidate.source}, model=${requestModel})`)
            continue
          }

          const parsed = normalizeAiResponse(payload)
          if (parsed.items.length === 0) {
            const rescuedJsonLike = deriveItemsFromJsonLikeText(content)
            if (rescuedJsonLike.length > 0) {
              const mergedItems = maybeSupplementWithRule(rescuedJsonLike, fallbackResult.items)
              const recoveredWarnings = [...parsed.warnings, `AI recovered via json-like fallback (${requestModel})`]
              if (mergedItems.length > rescuedJsonLike.length) {
                recoveredWarnings.push('AI supplemented with rule coverage')
              }
              return {
                items: mergedItems,
                warnings: recoveredWarnings,
                parseEngine: 'deepseek',
              }
            }

            const rescued = deriveItemsFromAiText(content)
            if (rescued.length > 0) {
              const mergedItems = maybeSupplementWithRule(rescued, fallbackResult.items)
              const recoveredWarnings = [...parsed.warnings, `AI recovered via text fallback (${requestModel})`]
              if (mergedItems.length > rescued.length) {
                recoveredWarnings.push('AI supplemented with rule coverage')
              }
              return {
                items: mergedItems,
                warnings: recoveredWarnings,
                parseEngine: 'deepseek',
              }
            }

            lastErrorReason = `no_items_${candidate.source}_${modelTag}`
            console.error(`DeepSeek response has no valid items (${candidate.source}, model=${requestModel})`)
            continue
          }

          const mergedItems = maybeSupplementWithRule(parsed.items, fallbackResult.items)
          const mergedWarnings = [...parsed.warnings]
          if (mergedItems.length > parsed.items.length) {
            mergedWarnings.push('AI supplemented with rule coverage')
          }

          return {
            items: mergedItems,
            warnings: mergedWarnings,
            parseEngine: 'deepseek',
          }
        } catch (error) {
          lastErrorReason = `exception_${candidate.source}_${modelTag}`
          console.error(`DeepSeek parse exception (${candidate.source}, model=${requestModel}):`, error)
          if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
            lastErrorReason = `timeout_${candidate.source}_${modelTag}`
          }
        }
      }

      if (candidateBlocked) {
        break
      }
    }
  }

  if (!userConfig?.chunkMode && lastErrorReason.startsWith('timeout_')) {
    const chunkRetryResult = await parseBomByChunks(text, userConfig, { force: true })
    if (chunkRetryResult?.parseEngine === 'deepseek') {
      chunkRetryResult.warnings = [
        ...chunkRetryResult.warnings,
        `AI retry via chunk after ${lastErrorReason}`
      ]
      return chunkRetryResult
    }
  }

  if (lastErrorReason) {
    fallbackResult.warnings.push(`AI fallback: ${lastErrorReason}`)
  }

  return { ...fallbackResult, parseEngine: 'rule' }
}

function buildModelCandidates(preferredModel?: string, envModel?: string): string[] {
  const queue = [
    preferredModel,
    envModel,
    'deepseek-chat',
    'deepseek-v3.2',
    'DeepSeek-V3.2',
    'deepseek-ai/DeepSeek-V3.2',
    'deepseek-v3',
    'deepseek-ai/DeepSeek-V3',
  ]

  const unique: string[] = []
  const seen = new Set<string>()

  for (const raw of queue) {
    const value = raw?.trim()
    if (!value) continue

    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(value)
  }

  return unique
}

function normalizeModelForEndpoint(model: string, endpoint: string): string {
  const normalizedEndpoint = endpoint.toLowerCase()
  const normalizedModel = model.trim().toLowerCase()

  if (!normalizedEndpoint.includes('api.deepseek.com')) {
    return model
  }

  if (normalizedModel === 'deepseek-chat' || normalizedModel === 'deepseek-reasoner') {
    return model
  }

  if (
    normalizedModel === 'deepseek-v3' ||
    normalizedModel === 'deepseek-v3.2' ||
    normalizedModel === 'deepseek-ai/deepseek-v3' ||
    normalizedModel === 'deepseek-ai/deepseek-v3.2'
  ) {
    return 'deepseek-chat'
  }

  return model
}

function sanitizeModelName(model: string): string {
  const normalized = model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'default-model'
}

function shouldSkipModelForEndpoint(endpoint: string, model: string): boolean {
  const key = `${endpoint.toLowerCase()}::${model.toLowerCase()}`
  const ts = modelSkipCache.get(key)
  if (!ts) return false

  if (Date.now() - ts > MODEL_SKIP_CACHE_TTL_MS) {
    modelSkipCache.delete(key)
    return false
  }

  return true
}

function markModelAsUnavailable(endpoint: string, model: string): void {
  const key = `${endpoint.toLowerCase()}::${model.toLowerCase()}`
  modelSkipCache.set(key, Date.now())
}

function buildCompletionEndpointCandidates(baseUrl: string): string[] {
  const normalized = baseUrl.replace(/\/+$/, '')

  if (isOfficialDeepSeekBase(normalized)) {
    return [`${normalized}/chat/completions`]
  }

  const candidates = [`${normalized}/chat/completions`]

  if (!/\/v\d+$/i.test(normalized)) {
    candidates.push(`${normalized}/v1/chat/completions`)
  }

  return Array.from(new Set(candidates))
}

function isOfficialDeepSeekBase(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl)
    return /(^|\.)api\.deepseek\.com$/i.test(url.hostname)
  } catch {
    return /(^|\.)api\.deepseek\.com(?:$|\/)/i.test(baseUrl)
  }
}

function buildCompletionRequest(model: string, text: string, maxTokens: number, strictJson: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: BOM_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    max_tokens: maxTokens,
    temperature: 0.1,
  }

  if (strictJson) {
    payload.response_format = { type: 'json_object' }
  }

  return payload
}

function isUnsupportedResponseFormatError(status: number, errText: string): boolean {
  if (![400, 422].includes(status)) return false
  const normalized = errText.toLowerCase()
  return /response_format|json_object/.test(normalized) && /unsupported|invalid|not\s*allowed|unknown/.test(normalized)
}

function classifyApiFailure(status: number, errText: string, source: string, modelTag: string): string {
  if (status === 401 || status === 403) {
    return `auth_${status}_${source}`
  }

  if (isModelNotSupported(status, errText)) {
    return `model_invalid_${source}_${modelTag}`
  }

  if (isLikelyEndpointMismatch(status, errText)) {
    return `endpoint_${status}_${source}`
  }

  return `api_${status}_${source}_${modelTag}`
}

function isModelNotSupported(status: number, errText: string): boolean {
  if (![400, 404, 422].includes(status)) return false

  const normalized = errText.toLowerCase()
  return (
    /model/.test(normalized) && /invalid|unsupported|unknown|not\s*found|does\s*not\s*exist/.test(normalized)
  ) || /model_not_found/.test(normalized)
}

function isLikelyEndpointMismatch(status: number, errText: string): boolean {
  if (status === 404 || status === 405) return true
  if (status !== 400) return false

  const normalized = errText.toLowerCase()
  return /invalid\s*url|route\s*not\s*found|path\s*not\s*found|unknown\s*endpoint/.test(normalized)
}

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    const chunks = content
      .map(part => {
        if (typeof part === 'string') return part
        if (!isRecord(part)) return ''
        if (typeof part.text === 'string') return part.text
        if (typeof part.content === 'string') return part.content
        return ''
      })
      .filter(Boolean)

    return chunks.join('\n').trim()
  }

  if (isRecord(content)) {
    if (typeof content.text === 'string') return content.text.trim()
    if (typeof content.content === 'string') return content.content.trim()
  }

  return ''
}

function extractJsonPayload(content: string): unknown | null {
  const candidates: string[] = []
  const seen = new Set<string>()

  const pushCandidate = (value?: string) => {
    if (!value) return
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    candidates.push(trimmed)
  }

  const trimmed = content.trim()
  pushCandidate(trimmed)

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  pushCandidate(fenced?.[1])

  const objectLike = trimmed.match(/\{[\s\S]*\}/)
  pushCandidate(objectLike?.[0])

  const arrayLike = trimmed.match(/\[[\s\S]*\]/)
  pushCandidate(arrayLike?.[0])

  for (const candidate of candidates) {
    const parsed = tryParseJsonCandidate(candidate)
    if (parsed !== null) return parsed
  }

  return null
}

function tryParseJsonCandidate(candidate: string): unknown | null {
  const direct = tryJsonParse(candidate)
  if (direct !== null) return unwrapNestedJsonString(direct)

  const relaxed = candidate
    .replace(/^\uFEFF+/, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')

  if (relaxed !== candidate) {
    const parsed = tryJsonParse(relaxed)
    if (parsed !== null) return unwrapNestedJsonString(parsed)
  }

  return null
}

function tryJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function unwrapNestedJsonString(value: unknown, depth = 0): unknown {
  if (depth > 3 || typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return value
  }

  const looksJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))

  if (!looksJson) {
    return value
  }

  const parsed = tryJsonParse(trimmed)
  if (parsed === null) {
    return value
  }

  return unwrapNestedJsonString(parsed, depth + 1)
}

function normalizeAiResponse(payload: unknown): { items: BomItem[]; warnings: string[] } {
  const warnings: string[] = []
  let rawItems: unknown[] = []

  if (Array.isArray(payload)) {
    rawItems = payload
  } else if (isRecord(payload)) {
    if (Array.isArray(payload.items)) rawItems = payload.items
    else if (Array.isArray(payload.components)) rawItems = payload.components
    else if (Array.isArray(payload.parts)) rawItems = payload.parts
    else {
      const guessed = findArrayLikeValue(payload)
      if (guessed) rawItems = guessed
    }

    if (rawItems.length === 0) {
      const single = normalizeAiItem(payload)
      if (single) rawItems = [payload]
    }

    if (Array.isArray(payload.warnings)) {
      for (const w of payload.warnings) {
        if (typeof w === 'string' && w.trim()) warnings.push(w.trim())
      }
    } else if (typeof payload.warning === 'string' && payload.warning.trim()) {
      warnings.push(payload.warning.trim())
    }
  }

  const items: BomItem[] = []
  for (const raw of rawItems) {
    const normalized = normalizeAiItem(raw) || normalizeAiLineItem(raw)
    if (normalized) items.push(normalized)
  }

  return { items, warnings }
}

function normalizeAiItem(raw: unknown): BomItem | null {
  if (!isRecord(raw)) return null

  const source = isRecord(raw.item) ? raw.item : raw

  const rawName = pickFirstString(source, ['name', 'model', 'part', 'component', '\u540d\u79f0', '\u5143\u5668\u4ef6'])
  if (!rawName) return null

  const rawSpec = pickFirstString(source, ['spec', 'value', 'package', 'footprint', '\u89c4\u683c']) || ''
  const name = localizeComponentText(rawName)
  const spec = localizeComponentText(rawSpec)
  const rawCategory = pickFirstString(source, ['category', 'type', '\u5206\u7c7b'])
  const category = normalizeCategoryLabel(rawCategory, name, spec)
  const quantityValue = pickFirstNumber(source, ['quantity', 'qty', 'count', '\u6570\u91cf'])
  const quantity = quantityValue && quantityValue > 0 ? Math.floor(quantityValue) : 1

  const rawKeyword = pickFirstString(source, ['searchKeyword', 'keyword', 'search', '\u641c\u7d22\u5173\u952e\u8bcd']) || `${name} ${spec}`.trim()
  const normalizedKeyword = localizeComponentText(rawKeyword)

  return {
    name,
    spec,
    quantity,
    searchKeyword: cleanSearchKeyword(normalizedKeyword, name, category),
    category,
  }
}

function normalizeAiLineItem(raw: unknown): BomItem | null {
  if (typeof raw !== 'string') return null
  const line = raw.trim()
  if (!line) return null

  const { body, quantity } = extractTrailingQuantity(line)
  const normalizedBody = normalizeParsedText(body)
  if (!normalizedBody) return null

  const { name: parsedName, spec: parsedSpec } = splitNameAndSpec(normalizedBody)
  if (!parsedName) return null

  const name = localizeComponentText(parsedName)
  const spec = localizeComponentText(parsedSpec)
  const category = inferCategory(name, spec)
  const rawKeyword = spec ? `${name} ${spec}` : name

  return {
    name,
    spec,
    quantity,
    searchKeyword: cleanSearchKeyword(rawKeyword, name, category),
    category,
  }
}

function deriveItemsFromAiText(content: string): BomItem[] {
  const lines = content
    .split(/[\n;\uFF1B]/)
    .map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(line => line && !isJsonArtifactLine(line))

  const items: BomItem[] = []
  for (const line of lines) {
    const normalized = normalizeAiLineItem(line)
    if (normalized) items.push(normalized)
  }

  return items
}

function deriveItemsFromJsonLikeText(content: string): BomItem[] {
  const objectCandidates = extractJsonLikeObjects(content)
  const items: BomItem[] = []

  for (const candidate of objectCandidates) {
    const normalizedCandidate = normalizeJsonLikeObject(candidate)
    const parsed = tryParseJsonCandidate(normalizedCandidate)
    if (parsed && isRecord(parsed)) {
      const normalized = normalizeAiItem(parsed)
      if (normalized) items.push(normalized)
    }
  }

  return dedupeBomItems(items)
}

function extractJsonLikeObjects(content: string): string[] {
  const normalized = content
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")

  const matches = normalized.match(/\{[^{}]*\}/g) || []
  return matches.filter(segment => /(?:name|spec|quantity|searchKeyword|category)/i.test(segment))
}

function normalizeJsonLikeObject(candidate: string): string {
  return candidate
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'([A-Za-z_][A-Za-z0-9_]*)'\s*:/g, '"$1":')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"')
    .replace(/,\s*([}\]])/g, '$1')
}

function maybeSupplementWithRule(aiItems: BomItem[], ruleItems: BomItem[]): BomItem[] {
  const normalizedAi = dedupeBomItems(aiItems)
  if (!ruleItems.length || normalizedAi.length >= ruleItems.length * 0.9) {
    return normalizedAi
  }

  const merged = new Map<string, BomItem>()
  for (const item of normalizedAi) {
    merged.set(buildBomItemKey(item), item)
  }

  for (const item of ruleItems) {
    const key = buildBomItemKey(item)
    if (!merged.has(key)) {
      merged.set(key, item)
    }
  }

  return Array.from(merged.values())
}

function dedupeBomItems(items: BomItem[]): BomItem[] {
  const unique = new Map<string, BomItem>()

  for (const item of items) {
    const key = buildBomItemKey(item)
    if (!unique.has(key)) {
      unique.set(key, item)
    }
  }

  return Array.from(unique.values())
}

function buildBomItemKey(item: BomItem): string {
  return `${normalizeBomKeyToken(item.name)}::${normalizeBomKeyToken(item.spec)}`
}

function normalizeBomKeyToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function splitBomTextLines(text: string): string[] {
  return text
    .split(/[\n;]/)
    .map(line => line.trim())
    .filter(Boolean)
}

function mergeBomItemsWithQuantity(items: BomItem[]): BomItem[] {
  const merged = new Map<string, BomItem>()

  for (const item of items) {
    const normalizedItem: BomItem = {
      ...item,
      quantity: Math.max(1, Number.isFinite(item.quantity) ? item.quantity : 1),
    }

    const key = buildBomItemKey(normalizedItem)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, normalizedItem)
      continue
    }

    existing.quantity += normalizedItem.quantity
    if ((!existing.spec || existing.spec === '') && normalizedItem.spec) existing.spec = normalizedItem.spec
    if ((!existing.searchKeyword || existing.searchKeyword === '') && normalizedItem.searchKeyword) {
      existing.searchKeyword = normalizedItem.searchKeyword
    }
    if ((!existing.category || existing.category === '\u5176\u4ed6') && normalizedItem.category) {
      existing.category = normalizedItem.category
    }
  }

  return Array.from(merged.values())
}

function compactAiWarnings(warnings: string[]): string[] {
  const aiWarnings = warnings.filter(w => w.startsWith('AI '))
  return Array.from(new Set(aiWarnings))
}

async function parseBomByChunks(
  text: string,
  userConfig?: BomParseConfig,
  options?: { force?: boolean }
): Promise<ParseResult | null> {
  const lines = splitBomTextLines(text)
  const shouldChunk = options?.force || lines.length >= 90 || text.length >= 18000
  if (!shouldChunk) {
    return null
  }

  const baseChunkSize = lines.length >= 360
    ? 64
    : lines.length >= 260
      ? 56
      : lines.length >= 180
        ? 48
        : 40
  const averageLineLength = Math.max(1, Math.ceil(text.length / Math.max(lines.length, 1)))
  const sizeByTextDensity = Math.max(20, Math.floor(12000 / averageLineLength))
  const chunkSize = Math.max(18, Math.min(baseChunkSize, sizeByTextDensity))
  const chunks: string[] = []
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize).join('\n'))
  }

  if (chunks.length <= 1) {
    return null
  }

  const collectedItems: BomItem[] = []
  const collectedWarnings: string[] = []
  let deepseekChunkCount = 0
  let ruleChunkCount = 0

  const batchSize = chunks.length <= 6 ? chunks.length : chunks.length <= 10 ? 6 : 7

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (chunk, offset) => {
        const chunkIndex = i + offset + 1
        const result = await parseBomText(chunk, { ...userConfig, chunkMode: true })
        return { chunkIndex, result }
      })
    )

    for (const { chunkIndex, result } of batchResults) {
      collectedItems.push(...result.items)

      if (result.parseEngine === 'deepseek') {
        deepseekChunkCount += 1
      } else {
        ruleChunkCount += 1
      }

      const aiWarnings = compactAiWarnings(result.warnings)
      for (const warning of aiWarnings) {
        collectedWarnings.push(`chunk${chunkIndex}: ${warning}`)
      }
    }
  }

  if (collectedItems.length === 0) {
    return null
  }

  const mergedItems = mergeBomItemsWithQuantity(collectedItems)
  const mergedWarnings = Array.from(new Set(collectedWarnings))

  if (deepseekChunkCount > 0) {
    if (ruleChunkCount > 0) {
      mergedWarnings.push(`AI partial chunk fallback: ${ruleChunkCount}/${chunks.length}`)
    }

    return {
      items: mergedItems,
      warnings: mergedWarnings,
      parseEngine: 'deepseek',
    }
  }

  return {
    items: mergedItems,
    warnings: mergedWarnings,
    parseEngine: 'rule',
  }
}

function isJsonArtifactLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true

  if (/^[{}\[\],]+$/.test(trimmed)) {
    return true
  }

  if (/^"?[A-Za-z0-9_\u4e00-\u9fa5]+"?\s*:\s*/.test(trimmed)) {
    return true
  }

  if (/^"(?:items|warnings|name|spec|quantity|searchKeyword|category)"\s*:/i.test(trimmed)) {
    return true
  }

  return false
}

function pickFirstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  const lowerMap = createLowerKeyMap(source)

  for (const key of keys) {
    const direct = source[key]
    if (typeof direct === 'string' && direct.trim()) return direct.trim()

    const lowered = lowerMap.get(normalizeKey(key))
    if (typeof lowered === 'string' && lowered.trim()) return lowered.trim()
  }

  return undefined
}

function pickFirstNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  const lowerMap = createLowerKeyMap(source)

  for (const key of keys) {
    const values = [source[key], lowerMap.get(normalizeKey(key))]

    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
      }
    }
  }

  return undefined
}

function findArrayLikeValue(source: Record<string, unknown>, depth = 0): unknown[] | null {
  if (depth > 3) return null

  for (const value of Object.values(source)) {
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0]
      if (isRecord(first) || typeof first === 'string') {
        return value
      }
    }

    if (isRecord(value)) {
      const nested = findArrayLikeValue(value, depth + 1)
      if (nested) return nested
    }
  }

  return null
}

function createLowerKeyMap(source: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>()
  for (const [key, value] of Object.entries(source)) {
    map.set(normalizeKey(key), value)
  }
  return map
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ruleBasedParse(text: string): ParseResult {
  const items: BomItem[] = []
  const warnings: string[] = []

  const lines = text.split(/[\n;]/).filter(l => l.trim().length > 0)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const { body, quantity } = extractTrailingQuantity(trimmed)
    const normalizedBody = normalizeParsedText(body)
    const { name: parsedName, spec: parsedSpec, lowConfidence } = splitNameAndSpec(normalizedBody)
    const name = localizeComponentText(parsedName)
    const spec = localizeComponentText(parsedSpec)
    const category = inferCategory(name, spec)
    const rawKeyword = spec ? `${name} ${spec}` : name

    items.push({
      name,
      spec,
      quantity,
      searchKeyword: cleanSearchKeyword(rawKeyword, name, category),
      category,
    })

    if (lowConfidence) {
      warnings.push(`Rule parser low confidence: ${trimmed}`)
    }
  }

  return { items, warnings, parseEngine: 'rule' }
}

/**
 * Scale AI response budget by BOM size to reduce JSON truncation fallback.
 */
function getDynamicAiBudget(
  text: string,
  options?: { chunkMode?: boolean }
): { maxTokens: number; timeoutMs: number } {
  const meaningfulLines = text
    .split(/[\n;]/)
    .map(line => line.trim())
    .filter(Boolean).length
  const estimatedItems = Math.max(meaningfulLines, Math.ceil(text.length / 90))

  if (options?.chunkMode) {
    const maxTokens = Math.max(896, Math.min(3072, 768 + estimatedItems * 18))
    const timeoutMs = Math.max(9000, Math.min(18000, 8000 + estimatedItems * 140))
    return { maxTokens, timeoutMs }
  }

  const maxTokens = Math.max(1024, Math.min(4096, 768 + estimatedItems * 30))
  const timeoutMs = Math.max(14000, Math.min(32000, 12000 + estimatedItems * 260))

  return { maxTokens, timeoutMs }
}

function normalizeBaseUrl(baseUrl?: string): string | undefined {
  if (!baseUrl) return undefined
  const trimmed = baseUrl.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/\/+$/, '')
}


/**
 * Extract trailing quantity from formats like x2, ×2, 2pcs, 2个, or " ... 2".
 */
function extractTrailingQuantity(line: string): { body: string; quantity: number } {
  const normalized = line.replace(/\s+/g, ' ').trim()
  const quantityPatterns: RegExp[] = [
    /(.*?)(?:\s*[x\u00D7*]\s*)(\d+)\s*$/i,
    /(.*?)(\d+)\s*(?:pcs?|pc|\u4E2A|\u53EA|\u4EF6|\u9897|\u679A|\u5957|\u6761|EA)\s*$/i,
    /(.*?)(?:\s+)(\d+)\s*$/,
  ]

  for (const pattern of quantityPatterns) {
    const match = normalized.match(pattern)
    if (!match) continue

    const qty = parseInt(match[2], 10)
    if (!Number.isFinite(qty) || qty <= 0) continue

    const body = normalizeParsedText(match[1])
    if (!body) break

    return { body, quantity: qty }
  }

  return { body: normalizeParsedText(normalized), quantity: 1 }
}

/**
 * Remove dangling suffix markers, e.g. trailing "x" after stripping quantity.
 */
function normalizeParsedText(text: string): string {
  return text
    .replace(/[\uFF0C,;\uFF1B\u3002]+$/g, '')
    .replace(/(?:\u5C01\u88C5|\u5C01\u88DD|\u5C01)\s*$/u, '')
    .replace(/\s*[x\u00D7*]\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split name/spec only in high-confidence patterns to avoid over-splitting.
 */
function splitNameAndSpec(text: string): { name: string; spec: string; lowConfidence: boolean } {
  if (!text) {
    return { name: 'Unknown component', spec: '', lowConfidence: true }
  }

  const explicitParts = text
    .split(/[\t,\uFF0C|]/)
    .map(part => part.trim())
    .filter(Boolean)

  if (explicitParts.length >= 2) {
    return {
      name: explicitParts[0],
      spec: explicitParts.slice(1).join(' '),
      lowConfidence: false,
    }
  }

  const modelLikeSplit = text.match(/^([A-Za-z][A-Za-z0-9._+-]{2,})\s+(.+)$/)
  if (modelLikeSplit) {
    const spec = modelLikeSplit[2].trim()
    const hasStrongSpecHint = /^(?:LQFP|QFP|TQFP|QFN|BGA|SOT|SOD|SOP|DIP|SOIC|0402|0603|0805|1206|1210|2010|2512|\d+(?:\.\d+)?\s*(?:R|K|M|\u03A9|OHM|UF|NF|PF|V|A))/i.test(spec)
    if (hasStrongSpecHint) {
      return {
        name: modelLikeSplit[1],
        spec,
        lowConfidence: false,
      }
    }
  }

  return { name: text, spec: '', lowConfidence: true }
}

/**
 * 根据关键词推断元器件分类
 */
function inferCategory(name: string, spec: string): string {
  const text = (name + ' ' + spec).toLowerCase()

  if (/stm32|esp32|at89|pic|arm|mcu|cpu|\u82af\u7247|\u5355\u7247\u673a/.test(text)) return '\u82af\u7247'
  if (/\u7535\u5bb9|cap|capacitor|uf|nf|pf/.test(text)) return '\u7535\u5bb9'
  if (/\u7535\u963b|res|resistor|\u6b27|ohm|k\u03c9|m\u03c9/.test(text)) return '\u7535\u963b'
  if (/\u7535\u611f|inductor|\u7ebf\u5708/.test(text)) return '\u7535\u611f'
  if (/\u4e8c\u6781\u7ba1|diode|led|\u53d1\u5149/.test(text)) return '\u4e8c\u6781\u7ba1'
  if (/\u4e09\u6781\u7ba1|transistor|mos|fet/.test(text)) return '\u4e09\u6781\u7ba1'
  if (/\u6a21\u5757|module|\u4f20\u611f\u5668|sensor/.test(text)) return '\u6a21\u5757'
  if (/\u8fde\u63a5\u5668|connector|\u6392\u9488|\u675c\u90a6/.test(text)) return '\u8fde\u63a5\u5668'
  if (/\u7ebf|wire|cable|\u5bfc\u7ebf/.test(text)) return '\u7ebf\u6750'
  if (/\u5de5\u5177|tool|\u710a/.test(text)) return '\u5de5\u5177'

  return '\u5176\u4ed6'
}

function normalizeCategoryLabel(category: string | undefined, name: string, spec: string): string {
  const raw = category?.trim()
  if (!raw) return inferCategory(name, spec)

  const text = raw.toLowerCase()

  if (/\u82af\u7247|\u5355\u7247\u673a|ic|mcu|cpu|soc|controller|processor|chip/.test(text)) return '\u82af\u7247'
  if (/\u7535\u5bb9|capacitor|\bcap\b/.test(text)) return '\u7535\u5bb9'
  if (/\u7535\u963b|resistor|resistance|\bres\b/.test(text)) return '\u7535\u963b'
  if (/\u7535\u611f|inductor|choke/.test(text)) return '\u7535\u611f'
  if (/\u4e8c\u6781\u7ba1|diode|\bled\b/.test(text)) return '\u4e8c\u6781\u7ba1'
  if (/\u4e09\u6781\u7ba1|transistor|mosfet|\bfet\b|\bbjt\b/.test(text)) return '\u4e09\u6781\u7ba1'
  if (/\u6a21\u5757|module|sensor|board/.test(text)) return '\u6a21\u5757'
  if (/\u8fde\u63a5\u5668|connector|header|socket|terminal|plug/.test(text)) return '\u8fde\u63a5\u5668'
  if (/\u7ebf\u6750|\u7ebf\u7f06|cable|wire|harness/.test(text)) return '\u7ebf\u6750'
  if (/\u5de5\u5177|tool|solder|\u710a\u63a5/.test(text)) return '\u5de5\u5177'
  if (/\u5176\u4ed6|other|misc|unknown/.test(text)) return '\u5176\u4ed6'

  return inferCategory(name, spec)
}

function localizeComponentText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const replacements: Array<[RegExp, string]> = [
    [/\bceramic capacitors?\b/gi, '\u9676\u74f7\u7535\u5bb9'],
    [/\belectrolytic capacitors?\b/gi, '\u7535\u89e3\u7535\u5bb9'],
    [/\btantalum capacitors?\b/gi, '\u94bd\u7535\u5bb9'],
    [/\bchip resistors?\b/gi, '\u8d34\u7247\u7535\u963b'],
    [/\bresistors?\b/gi, '\u7535\u963b'],
    [/\bcapacitors?\b/gi, '\u7535\u5bb9'],
    [/\binductors?\b/gi, '\u7535\u611f'],
    [/\bdiodes?\b/gi, '\u4e8c\u6781\u7ba1'],
    [/\btransistors?\b/gi, '\u4e09\u6781\u7ba1'],
    [/\bmosfets?\b/gi, 'MOS\u7ba1'],
    [/\bconnectors?\b/gi, '\u8fde\u63a5\u5668'],
    [/\bcables?\b/gi, '\u7ebf\u6750'],
    [/\bwires?\b/gi, '\u5bfc\u7ebf'],
    [/\bmodules?\b/gi, '\u6a21\u5757'],
    [/\bsensors?\b/gi, '\u4f20\u611f\u5668'],
    [/\bswitches?\b/gi, '\u5f00\u5173'],
    [/\bbuttons?\b/gi, '\u6309\u952e'],
    [/\bchips?\b/gi, '\u82af\u7247'],
    [/\bics?\b/gi, '\u82af\u7247'],
  ]

  let localized = trimmed
  for (const [pattern, replacement] of replacements) {
    localized = localized.replace(pattern, replacement)
  }

  return localized.replace(/\s{2,}/g, ' ').trim()
}

/**
 * 清理和优化搜索关键词，使其更适合淘宝搜索
 * 保留关键封装信息，移除 EDA 专用参数
 */
function cleanSearchKeyword(keyword: string, name: string, category: string): string {
  if (!keyword || keyword.trim() === '') {
    keyword = name
  }

  let cleaned = keyword.trim()

  // 0. 移除 Excel 解析时的标记和数量后缀
  cleaned = cleaned.replace(/(?:\u5C01\u88C5|\u5C01\u88DD|\u5C01)$/g, '') // remove trailing package suffix
  cleaned = cleaned.replace(/\s*[x\u00D7*]\s*\d*\s*$/i, '') // remove trailing quantity markers
  cleaned = cleaned.trim()

  // 1. 移除 EDA 软件生成的库代码前缀（但保留封装类型）
  // 例如：SW-TH_4P-L6.0-W6.0 → 保留有用部分，去掉尺寸
  cleaned = cleaned
    .replace(/SW-TH[_-][\w-]*/gi, '') // 移除 SW-TH 开关库代码
    .replace(/LCC-LGA-\d+[_-]?[LWH][\d.-]*/gi, 'LCC') // LCC-LGA-109_L17.7 → LCC
    .replace(/(?<![A-Za-z0-9])(?:L|W|H)\d+(?:\.\d+)?(?:-(?:L|W|H)\d+(?:\.\d+)?)*(?![A-Za-z0-9])/gi, ' ') // 移除 L17.7-W15.8-H2.5
    .trim()

  // 2. 提取并保留标准封装信息
  const packageMatch = cleaned.match(/(R|C|L)?(0201|0402|0603|0805|1206|1210|2010|2512)|QFP-?\d+|LQFP-?\d+|TQFP-?\d+|BGA-?\d+|SOT-?\d+|SOD-?\d+|DIP-?\d+|SOP-?\d+/gi)
  const sizeMatch = cleaned.match(/(\d+)[x×](\d+)/i) // 提取 6x6、12x12 等尺寸

  // 3. 针对不同类别优化
  const lowerName = name.toLowerCase()
  const lowerKeyword = cleaned.toLowerCase()

  // 电阻：保留阻值和封装
  if (category === '电阻') {
    const valueMatch = cleaned.match(/([\d.]+)(k|K|M|m|R|r|Ω|ω|ohm)?/i)
    const pkg = packageMatch ? packageMatch[0] : ''

    if (valueMatch) {
      const value = valueMatch[1]
      let unit = valueMatch[2]?.toUpperCase() || 'R'
      // 转换为中文电商常用格式
      if (unit === 'Ω' || unit === 'OHM') unit = 'R'
      if (unit === 'R' && parseFloat(value) >= 1000) {
        // 1000R 及以上转换为 K
        const kValue = parseFloat(value) / 1000
        cleaned = pkg ? `${pkg} ${kValue}K电阻` : `${kValue}K电阻`
      } else {
        // 封装号在前面：0805 10K电阻
        cleaned = pkg ? `${pkg} ${value}${unit}电阻` : `${value}${unit}电阻`
      }
    } else if (!/电阻|res/.test(lowerKeyword)) {
      cleaned = `${cleaned} 电阻`.trim()
    }
  }

  // 电容：保留容值和封装
  else if (category === '电容') {
    const valueMatch = cleaned.match(/([\d.]+)(p|n|u|m)?F/i)
    const pkg = packageMatch ? packageMatch[0] : ''

    if (valueMatch) {
      const value = valueMatch[1]
      const unit = valueMatch[2]?.toLowerCase() || ''
      // 封装号在前面：0805 10uF电容
      cleaned = pkg ? `${pkg} ${value}${unit}F电容` : `${value}${unit}F电容`
    } else if (!/电容|cap/.test(lowerKeyword)) {
      cleaned = `${cleaned} 电容`.trim()
    }
  }

  // 芯片：保留完整型号，只去掉封装代码前缀
  else if (category === '芯片') {
    // 移除 EDA 库代码前缀（如 SW-TH, LCC-LGA），但保留完整芯片型号
    cleaned = cleaned.replace(/^(SW-TH|LCC-LGA|SOT|QFP|BGA|LQFP|TQFP)[-_]/gi, '')

    // 移除封装后缀（通常在空格或下划线后）
    // 例如：STM32H750VBT6 LQFP100 → STM32H750VBT6
    cleaned = cleaned.replace(/[\s_]+((?:LQFP|QFP|TQFP|QFN|BGA|SOT|SOD|SOP|DIP|SOIC)-?\d+)$/i, '')

    cleaned = cleaned.trim()
  }

  // 连接器：简化为通用名称，但保留类型
  else if (category === '连接器') {
    if (/usb/i.test(lowerKeyword)) {
      if (/type-?c/i.test(lowerKeyword)) {
        cleaned = 'Type-C接口'
      } else if (/micro/i.test(lowerKeyword)) {
        cleaned = 'Micro USB接口'
      } else if (/mini/i.test(lowerKeyword)) {
        cleaned = 'Mini USB接口'
      } else {
        cleaned = 'USB接口'
      }
    } else if (/排针|pin.?header/i.test(lowerKeyword)) {
      cleaned = '排针'
    } else if (/排母|socket/i.test(lowerKeyword)) {
      cleaned = '排母'
    } else if (/杜邦|dupont/i.test(lowerKeyword)) {
      cleaned = '杜邦线'
    }
  }

  // 开关/按键：保留尺寸
  else if (/开关|switch|按键|button/i.test(lowerKeyword)) {
    if (/轻触|tact/i.test(lowerKeyword)) {
      if (sizeMatch) {
        cleaned = `轻触开关 ${sizeMatch[1]}x${sizeMatch[2]}`
      } else {
        cleaned = '轻触开关'
      }
    } else if (/拨动|slide/i.test(lowerKeyword)) {
      cleaned = '拨动开关'
    } else {
      cleaned = sizeMatch ? `按键开关 ${sizeMatch[1]}x${sizeMatch[2]}` : '按键开关'
    }
  }

  // 4. 通用清理：移除多余空格和特殊字符
  cleaned = cleaned
    .replace(/[_]{2,}/g, '_') // 多个下划线合并
    .replace(/[-]{2,}/g, '-') // 多个连字符合并
    .replace(/\s{2,}/g, ' ') // 多个空格合并
    .replace(/^[_\-\s]+|[_\-\s]+$/g, '') // 移除首尾特殊字符
    .trim()

  // 5. 如果清理后为空或太短，使用原名称
  if (cleaned.length < 2 || /^[\W_.-]+$/.test(cleaned) || /^\.?\d+(?:\.\d+)?$/.test(cleaned)) {
    cleaned = name.split(/[_\-\s]/)[0] // 取第一个单词
  }

  // 6. 限制长度（淘宝搜索建议 ≤ 30 字符）
  if (cleaned.length > 30) {
    // 优先保留前面的型号部分
    cleaned = cleaned.substring(0, 30)
  }


  cleaned = cleaned
    .replace(/(?:\u5C01\u88C5|\u5C01\u88DD|\u5C01)$/g, '')
    .replace(/\s*[x\u00D7*]\s*$/i, '')
    .trim()
  return cleaned
}
