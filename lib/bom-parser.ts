/**
 * BOM 解析引擎
 * 使用 AI 将用户输入的自然语言/文本解析为结构化元器件列表
 */

import Anthropic from '@anthropic-ai/sdk'

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
}

/**
 * 使用 AI 解析 BOM 文本
 */
export async function parseBomText(
  text: string,
  apiKey?: string,
  baseURL?: string
): Promise<ParseResult> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY
  const url = baseURL || process.env.ANTHROPIC_BASE_URL || 'https://yunwu.ai'

  if (!key) {
    // 降级到规则解析
    return ruleBasedParse(text)
  }

  try {
    const client = new Anthropic({ apiKey: key, baseURL: url })

    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-20250514',
      max_tokens: 2048,
      system: `你是一个电子元器件 BOM（物料清单）解析专家。用户会给你一段文字描述他们需要采购的电子元器件。

你的任务是将文本解析为结构化的 JSON 数组。

每个元器件需要提取：
- name: 元器件通用名称
- spec: 具体规格型号（如封装、阻值、容值等）
- quantity: 数量（默认为1）
- searchKeyword: 适合在淘宝搜索的关键词（要具体，便于搜索到正确商品）
- category: 分类（芯片/电容/电阻/电感/二极管/三极管/模块/连接器/线材/工具/其他）

如果某些信息不明确，在 warnings 数组中说明。

只返回 JSON，不要其他文字。格式：
{"items": [...], "warnings": ["..."]}`,
      messages: [{ role: 'user', content: text }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return ruleBasedParse(text)
    }

    // 提取 JSON
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return ruleBasedParse(text)
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParseResult
    return {
      items: parsed.items || [],
      warnings: parsed.warnings || [],
    }
  } catch (error) {
    console.error('AI BOM 解析失败，降级到规则解析:', error)
    return ruleBasedParse(text)
  }
}

/**
 * 基于规则的简单解析（AI 不可用时的降级方案）
 */
function ruleBasedParse(text: string): ParseResult {
  const items: BomItem[] = []
  const warnings: string[] = []

  // 按行或逗号/分号分割
  const lines = text
    .split(/[\n,;，；、]/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  for (const line of lines) {
    // 提取数量：支持 "x2", "×3", "*5", "2个", "50只" 等
    const qtyMatch = line.match(/[x×*]\s*(\d+)|(\d+)\s*[个只片颗根排条套件块]/)
    const quantity = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2]) : 1

    // 去掉数量部分
    let name = line
      .replace(/[x×*]\s*\d+/gi, '')
      .replace(/\d+\s*[个只片颗根排条套件块]/g, '')
      .trim()

    // 猜测分类
    let category = '其他'
    const lowerName = name.toLowerCase()
    if (/stm32|esp32|atmega|pic|51|arm|fpga|cpld|mcu|芯片|单片机|ic/i.test(lowerName)) {
      category = '芯片'
    } else if (/电容|容|cap|uf|nf|pf/i.test(lowerName)) {
      category = '电容'
    } else if (/电阻|阻|res|ohm|[kk]Ω/i.test(lowerName)) {
      category = '电阻'
    } else if (/电感|感|inductor|uh|mh/i.test(lowerName)) {
      category = '电感'
    } else if (/二极管|led|发光|diode/i.test(lowerName)) {
      category = '二极管'
    } else if (/三极管|mos|场效应|transistor/i.test(lowerName)) {
      category = '三极管'
    } else if (/模块|module|板|board|稳压|降压|升压/i.test(lowerName)) {
      category = '模块'
    } else if (/排针|排母|座|插|连接|header|connector|接口/i.test(lowerName)) {
      category = '连接器'
    } else if (/线|杜邦|wire|cable/i.test(lowerName)) {
      category = '线材'
    }

    items.push({
      name: name,
      spec: '',
      quantity,
      searchKeyword: name,
      category,
    })
  }

  if (items.length === 0) {
    warnings.push('未能识别到任何元器件，请检查输入格式')
  }

  return { items, warnings }
}
