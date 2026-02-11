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

const BOM_SYSTEM_PROMPT = `你是一个电子元器件 BOM（物料清单）解析专家。用户会给你一段文字描述他们需要采购的电子元器件。

你的任务是将文本解析为结构化的 JSON 数组。

每个元器件需要提取：
- name: 元器件通用名称（如 STM32F103C8T6、10kΩ电阻 等）
- spec: 具体规格型号（如封装、阻值、容值等，不要重复 name 中已有的信息）
- quantity: 数量（默认为1）
- searchKeyword: 适合在淘宝/立创商城搜索的简短关键词。要求：
  * 只保留核心型号名，去掉封装尺寸、引脚间距、焊盘参数等 EDA 信息
  * 例如 "ML307C-DC-CN LCC-LGA-109_L17.7-W15.8" 应提取为 "ML307C-DC-CN"
  * 例如 "10kΩ R0805" 应提取为 "10K电阻 0805"
  * 例如 "KH-6H-TJ SW-TH_4P-L6.0-W6.0" 应提取为 "按键开关 6x6"
  * 关键词要简短精准，去掉所有无关的封装尺寸数据
- category: 分类（芯片/电容/电阻/电感/二极管/三极管/模块/连接器/线材/工具/其他）

如果某些信息不明确，在 warnings 数组中说明。

只返回 JSON，不要其他文字。格式：
{"items": [...], "warnings": ["..."]}`

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
        temperature: 0.1,
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
    console.error('DeepSeek BOM 解析失败，降级到规则解析:', error)
    const result = ruleBasedParse(text)
    return { ...result, parseEngine: 'rule' }
  }
}

/**
 * 基于规则的简单解析（AI 不可用时的降级方案）
 * 支持 bom-file-parser 输出的结构化格式: "名称 [封装:xxx] x数量"
 */
function ruleBasedParse(text: string): ParseResult {
  const items: BomItem[] = []
  const warnings: string[] = []

  // 按行分割
  const lines = text
    .split(/[\n]/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  for (const line of lines) {
    // 提取封装标记 [封装:xxx]
    const fpMatch = line.match(/\[封装:([^\]]+)\]/)
    const footprint = fpMatch ? fpMatch[1].trim() : ''

    // 去掉封装标记
    const cleaned = line.replace(/\[封装:[^\]]+\]/, '').trim()

    // 提取数量：支持 "x2", "×3", "*5", "2个", "50只" 等
    const qtyMatch = cleaned.match(/[x×*]\s*(\d+)$|(\d+)\s*[个只片颗根排条套件块]/)
    const quantity = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2]) : 1

    // 去掉数量部分
    const name = cleaned
      .replace(/[x×*]\s*\d+$/gi, '')
      .replace(/\d+\s*[个只片颗根排条套件块]/g, '')
      .trim()

    if (!name) continue

    // 猜测分类
    let category = '其他'
    const lowerName = name.toLowerCase()
    if (/stm32|esp32|atmega|pic|51|arm|fpga|cpld|mcu|芯片|单片机|ic|ml307|ch340|cp210|w25q|at24|max232|lm317|ams1117|tps|lt|ad[0-9]/i.test(lowerName)) {
      category = '芯片'
    } else if (/电容|容|cap|uf|nf|pf|μf/i.test(lowerName)) {
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
    } else if (/按键|开关|switch|button|key|sw|tact/i.test(lowerName)) {
      category = '开关'
    } else if (/线|杜邦|wire|cable/i.test(lowerName)) {
      category = '线材'
    } else if (/晶振|crystal|osc|mhz/i.test(lowerName)) {
      category = '晶振'
    } else if (/屏|lcd|oled|tft|display|显示/i.test(lowerName)) {
      category = '显示屏'
    }

    // 生成搜索关键词
    const searchKeyword = footprint
      ? buildSearchKeyword(name, footprint, category)  // 有封装标记（来自 Excel）
      : cleanSearchKeyword(name, category)              // 无封装标记（纯文本输入）

    // spec 保留封装信息
    const spec = footprint || ''

    items.push({
      name,
      spec,
      quantity,
      searchKeyword,
      category,
    })
  }

  if (items.length === 0) {
    warnings.push('未能识别到任何元器件，请检查输入格式')
  }

  return { items, warnings, parseEngine: 'rule' }
}

/**
 * 构建搜索关键词：核心型号 + 有用的封装信息
 * 策略：
 * - 芯片/IC: 只用型号名（如 STM32F103C8T6）
 * - 电阻/电容: 值 + 封装尺寸（如 10K电阻 0805）
 * - 开关/连接器: 型号 + 简化特征
 * - 其他: 型号 + 清理后的封装
 */
function buildSearchKeyword(name: string, footprint: string, category: string): string {
  // 先去重：如果 name 中有重复的词
  const deduped = deduplicateWords(name)

  // 针对不同类别生成关键词
  if (category === '电阻') {
    const valMatch = deduped.match(/(\d+\.?\d*)\s*([kKmM]?)\s*[ΩΩ欧ohm]/i)
    if (valMatch) {
      return `${valMatch[1]}${valMatch[2]}电阻${footprint ? ' ' + footprint : ''}`
    }
    return footprint ? `${deduped} ${footprint}` : deduped
  }

  if (category === '电容') {
    const valMatch = deduped.match(/(\d+\.?\d*)\s*(uf|nf|pf|μf)/i)
    if (valMatch) {
      return `${valMatch[1]}${valMatch[2]}电容${footprint ? ' ' + footprint : ''}`
    }
    return footprint ? `${deduped} ${footprint}` : deduped
  }

  if (category === '芯片') {
    // IC 用核心型号即可，不需要封装
    return deduped
  }

  if (category === '显示屏') {
    // 显示屏加封装有意义（尺寸信息）
    return footprint ? `${deduped} ${footprint}` : deduped
  }

  // 其他：型号 + 简化封装
  if (footprint) {
    return `${deduped} ${footprint}`
  }
  return deduped
}

/**
 * 去重：去除名称中重复出现的词
 * "HS12832 HS12832" → "HS12832"
 * "10kΩ 10kΩ" → "10kΩ"
 */
function deduplicateWords(text: string): string {
  const words = text.split(/\s+/)
  const seen = new Set<string>()
  const result: string[] = []

  for (const word of words) {
    const lower = word.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      result.push(word)
    }
  }

  return result.join(' ')
}

/**
 * 清理搜索关键词：去除 EDA 封装尺寸、引脚间距等无用信息
 * 保留为旧文本输入模式使用
 */
function cleanSearchKeyword(rawName: string, category: string): string {
  let keyword = rawName

  // 去除常见 EDA 封装描述模式
  keyword = keyword.replace(/_?[LlWwHhPp]\d+\.?\d*[-x×][WwHhPp]?\d+\.?\d*[-x×]?[Pp]?\d*\.?\d*/g, '')
  keyword = keyword.replace(/\s+(LCC|LGA|LQFP|QFP|QFN|BGA|SOP|SSOP|TSSOP|SOT|DIP|SOIC|DFN|WLCSP|TO)-?\d*/gi, '')
  keyword = keyword.replace(/\s*(SW-TH|SMD|TH|SMT)[-_]?\d*[Pp]?/gi, '')
  keyword = keyword.replace(/_MC\d+/g, '')
  keyword = keyword.replace(/-LS\d+\.?\d*/g, '')
  keyword = keyword.replace(/[_]+$/, '').replace(/\s+/g, ' ').trim()

  if (keyword.length < 2) {
    keyword = rawName.split(/[\s_]/)[0]
  }

  // 去重
  keyword = deduplicateWords(keyword)

  // 被动元件友好搜索词
  if (category === '电阻') {
    const valMatch = keyword.match(/(\d+[kKmM]?)\s*[ΩΩ欧ohm]/i)
    const pkgMatch = keyword.match(/[Rr]?(\d{4})/)?.[1]
    if (valMatch) {
      keyword = `${valMatch[1]}电阻${pkgMatch ? ' ' + pkgMatch : ''}`
    }
  } else if (category === '电容') {
    const valMatch = keyword.match(/(\d+\.?\d*)\s*(uf|nf|pf|μf)/i)
    const pkgMatch = keyword.match(/[Cc]?(\d{4})/)?.[1]
    if (valMatch) {
      keyword = `${valMatch[1]}${valMatch[2]}电容${pkgMatch ? ' ' + pkgMatch : ''}`
    }
  }

  return keyword
}
