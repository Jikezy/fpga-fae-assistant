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
        model: 'deepseek-coder', // 使用 deepseek-coder 更快
        messages: [
          { role: 'system', content: BOM_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        max_tokens: 1024, // 从 2048 降到 1024
        temperature: 0.7, // 提高到 0.7 加快速度
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

    // 清理和优化搜索关键词
    const cleanedItems = parsed.items.map(item => ({
      ...item,
      searchKeyword: cleanSearchKeyword(item.searchKeyword, item.name, item.category)
    }))

    return {
      items: cleanedItems,
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

/**
 * 清理和优化搜索关键词，使其更适合淘宝搜索
 */
function cleanSearchKeyword(keyword: string, name: string, category: string): string {
  if (!keyword || keyword.trim() === '') {
    keyword = name
  }

  let cleaned = keyword.trim()

  // 1. 移除常见的封装代码和尺寸参数
  cleaned = cleaned
    .replace(/[_-]?(LCC|LGA|QFN|QFP|TQFP|LQFP|BGA|CSP|SOP|SSOP|TSOP|TSSOP|DIP|SOT|TO|DO|SMD|THT|SW-TH)[_-]?[\w-]*/gi, '')
    .replace(/[_-]?[LWH][\d.]+[_-]?/gi, '') // L17.7, W15.8, H2.5
    .replace(/[_-]?\d+P[_-]?/gi, '') // 4P, 6P
    .replace(/[_-]?\d+Pin[_-]?/gi, '') // 4Pin, 6Pin
    .trim()

  // 2. 针对不同类别优化
  const lowerName = name.toLowerCase()
  const lowerKeyword = cleaned.toLowerCase()

  // 电阻：确保有"电阻"关键词
  if (category === '电阻' && !/电阻|res|ohm/.test(lowerKeyword)) {
    if (/\d+k|k\d+/i.test(cleaned)) {
      cleaned = cleaned.replace(/(\d+k)/i, '$1电阻')
    } else if (/\d+ω|ω\d+/i.test(cleaned)) {
      cleaned = cleaned.replace(/([\d.]+)ω/i, '$1电阻')
    } else {
      cleaned = `${cleaned} 电阻`.trim()
    }
  }

  // 电容：确保有"电容"关键词
  if (category === '电容' && !/电容|cap/.test(lowerKeyword)) {
    cleaned = `${cleaned} 电容`.trim()
  }

  // 连接器/开关：简化为通用名称
  if (category === '连接器') {
    if (/usb/i.test(lowerKeyword)) {
      cleaned = 'USB接口'
    } else if (/type-?c/i.test(lowerKeyword)) {
      cleaned = 'Type-C接口'
    } else if (/micro/i.test(lowerKeyword)) {
      cleaned = 'Micro USB接口'
    } else if (/排针|pin.?header/i.test(lowerKeyword)) {
      cleaned = '排针'
    } else if (/排母|socket/i.test(lowerKeyword)) {
      cleaned = '排母'
    } else if (/杜邦|dupont/i.test(lowerKeyword)) {
      cleaned = '杜邦线'
    }
  }

  // 开关/按键：简化
  if (/开关|switch|按键|button/i.test(lowerKeyword)) {
    if (/轻触|tact/i.test(lowerKeyword)) {
      const size = cleaned.match(/(\d+)[x×](\d+)/i)
      cleaned = size ? `轻触开关 ${size[1]}x${size[2]}` : '轻触开关'
    } else if (/拨动|slide/i.test(lowerKeyword)) {
      cleaned = '拨动开关'
    } else {
      cleaned = '按键开关'
    }
  }

  // 3. 移除多余空格和特殊字符
  cleaned = cleaned
    .replace(/[_\-]{2,}/g, '-') // 多个连字符合并
    .replace(/\s{2,}/g, ' ') // 多个空格合并
    .replace(/^[_\-\s]+|[_\-\s]+$/g, '') // 移除首尾特殊字符
    .trim()

  // 4. 如果清理后为空或太短，使用原名称
  if (cleaned.length < 2) {
    cleaned = name.split(/[_\-\s]/)[0] // 取第一个单词
  }

  // 5. 限制长度（淘宝搜索建议 ≤ 30 字符）
  if (cleaned.length > 30) {
    cleaned = cleaned.substring(0, 30)
  }

  return cleaned
}
