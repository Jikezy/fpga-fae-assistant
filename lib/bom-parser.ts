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

const BOM_SYSTEM_PROMPT = `你是电子元器件 BOM 解析专家。将文本解析为 JSON。

每个元器件提取：
- name: 元器件名称（如 STM32F103C8T6、10kΩ电阻）
- spec: 规格（如封装、阻值，不重复 name）
- quantity: 数量（默认1）
- searchKeyword: 淘宝搜索关键词，要求简短（≤20字符）
  * 去掉所有 LCC/LGA/QFN/SW-TH/LCC-LGA 等封装代码
  * 去掉 L17.7/W15.8/4P/6P 等尺寸参数
  * 芯片只保留型号：ML307C-DC-CN、STM32F103C8T6
  * 电阻电容加通用名：10K电阻 0805、10uF电容
  * 连接器/开关加通用名：USB接口、按键开关、排针
- category: 芯片/电容/电阻/电感/二极管/三极管/模块/连接器/线材/工具/其他

只返回JSON：{"items": [...], "warnings": []}`

/**
 * 使用 DeepSeek AI 解析 BOM 文本
 * 优先用用户自己的 DeepSeek 配置，回退到系统环境变量，最后降级规则解析
 */
export async function parseBomText(text: string, userConfig?: { apiKey?: string; baseUrl?: string }): Promise<ParseResult> {
  const userApiKey = userConfig?.apiKey?.trim()
  const envApiKey = process.env.DEEPSEEK_API_KEY?.trim()
  const userBaseUrl = normalizeBaseUrl(userConfig?.baseUrl)
  const defaultBaseUrl = 'https://api.deepseek.com'
  const { maxTokens, timeoutMs } = getDynamicAiBudget(text)
  const fallbackResult = ruleBasedParse(text)

  const candidates: Array<{ apiKey: string; baseUrl: string; source: 'user' | 'env' }> = []

  if (userApiKey) {
    candidates.push({
      apiKey: userApiKey,
      baseUrl: userBaseUrl || defaultBaseUrl,
      source: 'user',
    })
  }

  if (envApiKey && envApiKey !== userApiKey) {
    candidates.push({
      apiKey: envApiKey,
      baseUrl: defaultBaseUrl,
      source: 'env',
    })
  }

  if (candidates.length === 0) {
    console.warn('DeepSeek API key is missing in both user config and env, fallback to rule parser')
    return { ...fallbackResult, parseEngine: 'rule' }
  }

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${candidate.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: BOM_SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
          max_tokens: maxTokens,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`DeepSeek API request failed (${candidate.source}):`, response.status, errText)
        continue
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        console.error(`DeepSeek response content is empty (${candidate.source})`)
        continue
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error(`DeepSeek response does not contain JSON (${candidate.source}):`, content)
        continue
      }

      const parsed = JSON.parse(jsonMatch[0]) as ParseResult
      const cleanedItems = parsed.items.map(item => ({
        ...item,
        searchKeyword: cleanSearchKeyword(item.searchKeyword, item.name, item.category),
      }))

      return {
        items: cleanedItems,
        warnings: parsed.warnings || [],
        parseEngine: 'deepseek',
      }
    } catch (error) {
      console.error(`DeepSeek parse exception (${candidate.source}):`, error)
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        console.warn(`DeepSeek request timeout (${candidate.source}), trying next candidate or fallback`)
      }
    }
  }

  return { ...fallbackResult, parseEngine: 'rule' }
}

/**
 * 规则引擎：当 DeepSeek API 不可用时的降级方案
 * 基于正则表达式和关键词匹配解析
 */
function ruleBasedParse(text: string): ParseResult {
  const items: BomItem[] = []
  const warnings: string[] = []

  const lines = text.split(/[\n;]/).filter(l => l.trim().length > 0)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const { body, quantity } = extractTrailingQuantity(trimmed)
    const normalizedBody = normalizeParsedText(body)
    const { name, spec, lowConfidence } = splitNameAndSpec(normalizedBody)
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
function getDynamicAiBudget(text: string): { maxTokens: number; timeoutMs: number } {
  const meaningfulLines = text
    .split(/[\n;]/)
    .map(line => line.trim())
    .filter(Boolean).length
  const estimatedItems = Math.max(meaningfulLines, Math.ceil(text.length / 30))

  const maxTokens = Math.max(512, Math.min(3072, 256 + estimatedItems * 40))
  const timeoutMs = Math.max(9000, Math.min(18000, 7000 + estimatedItems * 160))

  return { maxTokens, timeoutMs }
}

function normalizeBaseUrl(baseUrl?: string): string | undefined {
  if (!baseUrl) return undefined
  const trimmed = baseUrl.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/\/$/, '')
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

  if (/stm32|esp32|at89|pic|arm|mcu|cpu|芯片|单片机/.test(text)) return '芯片'
  if (/电容|cap|capacitor|uf|nf|pf/.test(text)) return '电容'
  if (/电阻|res|resistor|欧|ohm|kω|mω/.test(text)) return '电阻'
  if (/电感|inductor|线圈/.test(text)) return '电感'
  if (/二极管|diode|led|发光/.test(text)) return '二极管'
  if (/三极管|transistor|mos|fet/.test(text)) return '三极管'
  if (/模块|module|传感器|sensor/.test(text)) return '模块'
  if (/连接器|connector|排针|杜邦/.test(text)) return '连接器'
  if (/线|wire|cable|导线/.test(text)) return '线材'
  if (/工具|tool|焊/.test(text)) return '工具'

  return '其他'
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
  cleaned = cleaned.replace(/(?:\u5C01\u88C5|\u5C01\u88DD)$/g, '') // remove trailing package suffix
  cleaned = cleaned.replace(/\s+x\d*\s*$/i, '') // 移除末尾的 x2, x10, 或单独的 x
  cleaned = cleaned.trim()

  // 1. 移除 EDA 软件生成的库代码前缀（但保留封装类型）
  // 例如：SW-TH_4P-L6.0-W6.0 → 保留有用部分，去掉尺寸
  cleaned = cleaned
    .replace(/SW-TH[_-][\w-]*/gi, '') // 移除 SW-TH 开关库代码
    .replace(/LCC-LGA-\d+[_-]?[LWH][\d.-]*/gi, 'LCC') // LCC-LGA-109_L17.7 → LCC
    .replace(/[_-]?[LWH][\d.]+(-[LWH][\d.]+)*/gi, '') // 移除 L17.7-W15.8-H2.5
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
    cleaned = cleaned.replace(/[\s_]+([LQFP|QFP|BGA|SOT|SOP|DIP|SOIC]+[-\d]+)$/i, '')

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
  if (cleaned.length < 2) {
    cleaned = name.split(/[_\-\s]/)[0] // 取第一个单词
  }

  // 6. 限制长度（淘宝搜索建议 ≤ 30 字符）
  if (cleaned.length > 30) {
    // 优先保留前面的型号部分
    cleaned = cleaned.substring(0, 30)
  }

  return cleaned
}
