/**
 * BOM 文件解析器
 * 支持 Excel (.xlsx/.xls/.csv) 和 PDF 文件
 * 正确分离 EDA 导出表的 Name / Value / Footprint 列
 */

import * as XLSX from 'xlsx'

export interface ExtractedRow {
  name: string       // 元器件名称/型号
  value: string      // Value 列（电阻阻值、电容容值，IC 型号等）
  footprint: string  // 封装信息（R0805, LQFP-48 等）
  quantity: string   // 数量
  designator: string // 位号（R1, C2, U3 等）
}

/**
 * 解析 Excel/CSV 文件，提取结构化内容
 * 返回给 AI 或规则引擎解析时带有结构标记，便于生成更好的搜索关键词
 */
export function parseExcelBuffer(buffer: Buffer, filename: string): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const allRows: ExtractedRow[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })

    if (data.length === 0) continue

    // 识别表头行
    const headerKeywords = ['名称', '型号', '规格', '数量', 'name', 'part', 'qty', 'quantity', 'value', 'footprint', 'component', '元器件', '物料', '描述', 'description', 'reference', 'designator', 'comment', '封装', 'package']
    let headerRowIdx = -1

    for (let i = 0; i < Math.min(data.length, 5); i++) {
      const row = data[i]
      if (!row) continue
      const rowText = row.join(' ').toLowerCase()
      const matchCount = headerKeywords.filter(kw => rowText.includes(kw)).length
      if (matchCount >= 1) {
        headerRowIdx = i
        break
      }
    }

    // 精细识别各列：名称、值、封装、数量、位号
    let nameCol = -1
    let valueCol = -1
    let footprintCol = -1
    let qtyCol = -1
    let designatorCol = -1

    if (headerRowIdx >= 0) {
      const header = data[headerRowIdx]
      for (let c = 0; c < header.length; c++) {
        const h = String(header[c]).toLowerCase().trim()

        // 位号列（Designator / Reference）
        if (designatorCol === -1 && /^(designator|reference|ref|位号)$/.test(h)) {
          designatorCol = c
          continue
        }
        // 数量列
        if (qtyCol === -1 && /数量|qty|quantity|count|个数|num/.test(h)) {
          qtyCol = c
          continue
        }
        // 封装列 — 必须在 value 之前检测，避免被 value 匹配走
        if (footprintCol === -1 && /footprint|封装|package|pcb.?footprint/.test(h)) {
          footprintCol = c
          continue
        }
        // Value 列（阻值、容值等）
        if (valueCol === -1 && /^(value|值|comment)$/.test(h)) {
          valueCol = c
          continue
        }
        // 名称列（兜底匹配）
        if (nameCol === -1 && /名称|name|part|component|元器件|物料|描述|description|型号|规格|spec|model/.test(h)) {
          nameCol = c
          continue
        }
      }
    }

    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0

    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      if (!row || row.every((cell: string) => !cell || String(cell).trim() === '')) continue

      if (nameCol >= 0 || valueCol >= 0) {
        const name = nameCol >= 0 ? String(row[nameCol] || '').trim() : ''
        const value = valueCol >= 0 ? String(row[valueCol] || '').trim() : ''
        const footprint = footprintCol >= 0 ? String(row[footprintCol] || '').trim() : ''
        const qty = qtyCol >= 0 ? String(row[qtyCol] || '1').trim() : '1'
        const designator = designatorCol >= 0 ? String(row[designatorCol] || '').trim() : ''

        // 跳过空行
        if (!name && !value) continue

        allRows.push({ name, value, footprint, quantity: qty, designator })
      } else {
        // 无表头：把整行非空单元格拼起来
        const text = row
          .map((cell: string) => String(cell).trim())
          .filter((cell: string) => cell.length > 0)
          .join(' ')
        if (text) {
          allRows.push({ name: text, value: '', footprint: '', quantity: '1', designator: '' })
        }
      }
    }
  }

  // 合并相同元器件（按 name+value+footprint 去重，累加数量）
  const merged = mergeRows(allRows)

  // 输出结构化文本，便于 AI 或规则引擎解析
  return merged.map(row => {
    const parts: string[] = []

    // 确定显示名称：优先用 value（如果 value 和 name 不同且 value 是有意义的型号）
    const displayName = getDisplayName(row.name, row.value)
    parts.push(displayName)

    // 封装信息（清理后）
    const cleanFp = cleanFootprint(row.footprint)
    if (cleanFp) parts.push(`[封装:${cleanFp}]`)

    // 数量
    const qty = parseInt(row.quantity) || 1
    if (qty > 1) parts.push(`x${qty}`)

    return parts.join(' ')
  }).join('\n')
}

/**
 * 合并相同元器件行（按 name+value+footprint 去重，数量累加）
 */
function mergeRows(rows: ExtractedRow[]): ExtractedRow[] {
  const map = new Map<string, ExtractedRow>()

  for (const row of rows) {
    const key = `${row.name}||${row.value}||${row.footprint}`
    const existing = map.get(key)
    if (existing) {
      const existQty = parseInt(existing.quantity) || 1
      const newQty = parseInt(row.quantity) || 1
      existing.quantity = String(existQty + newQty)
      if (row.designator && existing.designator) {
        existing.designator += ',' + row.designator
      }
    } else {
      map.set(key, { ...row })
    }
  }

  return Array.from(map.values())
}

/**
 * 确定显示名称：处理 name 和 value 相同/不同的情况
 * EDA 导出中：
 * - IC: name="STM32F103C8T6", value="STM32F103C8T6" → 只显示一次
 * - 电阻: name="R_0805", value="10kΩ" → 显示 "10kΩ"
 * - 电容: name="C_0805", value="100nF" → 显示 "100nF"
 */
function getDisplayName(name: string, value: string): string {
  if (!value) return name
  if (!name) return value

  const normName = name.toLowerCase().replace(/[_\-\s]/g, '')
  const normValue = value.toLowerCase().replace(/[_\-\s]/g, '')

  // 完全相同 → 只显示一次
  if (normName === normValue) return name

  // name 是通用封装前缀（R_, C_, L_, D_, LED_, SW_ 等）→ 用 value 为主
  if (/^(r|c|l|d|led|sw|btn|j|p|u|q|f|fb|tv|zd|y|x)[\s_]/i.test(name)) {
    return value
  }

  // value 看起来像阻值/容值（10k, 100nF, 4.7uF 等）→ value 为主，name 为补充
  if (/^\d+\.?\d*\s*(k|m|u|n|p|μ)?(Ω|ω|ohm|f|h|v)?$/i.test(value)) {
    return value
  }

  // 其他情况：name 和 value 都有意义，拼接
  return `${name} ${value}`
}

/**
 * 清理封装信息：去除 EDA 尺寸参数，保留有用的封装名
 * "LQFP-48_L7.0-W7.0-P0.50" → "LQFP-48"
 * "R0805" → "0805"
 * "SW-TH_4P-L6.0-W6.0-P4.50-LS6.5" → "直插4P"
 * "SOT-23-3" → "SOT-23"
 */
function cleanFootprint(fp: string): string {
  if (!fp) return ''

  let clean = fp

  // 去除 EDA 尺寸参数 (_Lxx.x-Wxx.x-Pxx.x-LSxx.x 等)
  clean = clean.replace(/_[LlWwHh]\d+\.?\d*[-_][WwHhPp]\d+\.?\d*.*$/g, '')

  // 去除 _MCxxx 后缀
  clean = clean.replace(/_MC\d+/g, '')

  // 如果是 R+4位数字 (如 R0805)，提取封装尺寸
  const rMatch = clean.match(/^[RrCcLl](\d{4})$/)
  if (rMatch) return rMatch[1]

  // 保留核心封装名称
  clean = clean.replace(/[-_]\d+P$/i, '') // 去除引脚数后缀如 -4P

  return clean.trim()
}

/**
 * 解析 PDF 文件，提取文本内容
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const { getDocumentProxy } = await import('unpdf')

  const uint8 = new Uint8Array(buffer)
  const doc = await getDocumentProxy(uint8)

  const lines: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: Record<string, unknown>) => (item.str as string) || '')
      .join(' ')
      .trim()

    if (pageText) lines.push(pageText)
  }

  return lines.join('\n')
}

/**
 * 解析 CSV 文本
 */
export function parseCsvText(text: string): string {
  // CSV 直接当 Excel 处理
  const buffer = Buffer.from(text, 'utf-8')
  return parseExcelBuffer(buffer, 'input.csv')
}
