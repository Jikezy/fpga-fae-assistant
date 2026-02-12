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
- searchKeyword: 淘宝搜索关键词，去掉封装尺寸、焊盘等EDA信息
  例："ML307C-DC-CN LCC-LGA-109" → "ML307C-DC-CN"
  例："10kΩ R0805" → "10K电阻 0805"
- category: 芯片/电容/电阻/电感/二极管/三极管/模块/连接器/线材/工具/其他

只返回JSON：{"items": [...], "warnings": [...]}`

/**
 * 使用 DeepSeek AI 解析 BOM 文本
 * 优先用用户自己的 DeepSeek 配置，回退到系统环境变量，最后降级规则解析
 */
export async function parseBomText(text: string, userConfig?: { apiKey?: string; baseUrl?: string }): Promise<ParseResult> {
  const apiKey = userConfig?.apiKey || process.env.DEEPSEEK_API_KEY
  const baseUrl = userConfig?.baseUrl || 'https://api.deepseek.com'

  if (!apiKey) {
    console.warn('DeepSeek API Key 未配置（用户未配置且系统环境变量也为空），使用规则解析')
    const result = ruleBasedParse(text)
    return { ...result, parseEngine: 'rule' }
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: BOM_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        max_tokens: 2048,
        temperature: 0.5, // 提高到 0.5 加快推理速度
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('DeepSeek API 请求失败:', response.status, errText)
      const result = ruleBasedParse(text)
      return { ...result, parseEngine: 'rule' }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.error('DeepSeek 返回内容为空')
      const result = ruleBasedParse(text)
      return { ...result, parseEngine: 'rule' }
    }

    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('DeepSeek 返回内容不包含 JSON:', content)
      const result = ruleBasedParse(text)
      return { ...result, parseEngine: 'rule' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParseResult
    return {
      items: parsed.items || [],
      warnings: parsed.warnings || [],
      parseEngine: 'deepseek',
    }
  } catch (error) {
    console.error('DeepSeek 解析异常:', error)
    const result = ruleBasedParse(text)
    return { ...result, parseEngine: 'rule' }
  }
}

/**
 * 规则引擎：当 DeepSeek API 不可用时的降级方案
 * 基于正则表达式和关键词匹配解析
 */
function ruleBasedParse(text: string): ParseResult {
  const items: BomItem[] = []
  const warnings: string[] = []

  // 按行或分号分割
  const lines = text.split(/[\n;]/).filter(l => l.trim().length > 0)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 尝试匹配常见格式：名称 规格 数量
    const match = trimmed.match(/^([^\s]+)\s+([^\d]+)?\s*(\d+)?\s*$/i)

    if (match) {
      const name = match[1]
      const spec = match[2]?.trim() || ''
      const quantity = match[3] ? parseInt(match[3]) : 1

      items.push({
        name,
        spec,
        quantity,
        searchKeyword: name + (spec ? ' ' + spec : ''),
        category: inferCategory(name, spec),
      })
    } else {
      // 如果格式不匹配，整行作为一个元器件
      const qty = trimmed.match(/\d+\s*$/)?.[0]
      const qtyNum = qty ? parseInt(qty) : 1
      const nameSpec = qty ? trimmed.slice(0, -qty.length).trim() : trimmed

      items.push({
        name: nameSpec,
        spec: '',
        quantity: qtyNum,
        searchKeyword: nameSpec,
        category: inferCategory(nameSpec, ''),
      })

      warnings.push(`无法准确解析: ${trimmed}`)
    }
  }

  return { items, warnings, parseEngine: 'rule' }
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
