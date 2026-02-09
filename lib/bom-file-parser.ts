/**
 * BOM 文件解析器
 * 支持 Excel (.xlsx/.xls/.csv) 和 PDF 文件
 */

import * as XLSX from 'xlsx'

/**
 * 解析 Excel/CSV 文件，提取文本内容
 */
export function parseExcelBuffer(buffer: Buffer, filename: string): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const lines: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })

    if (data.length === 0) continue

    // 尝试识别表头行：找包含关键词的行
    const headerKeywords = ['名称', '型号', '规格', '数量', 'name', 'part', 'qty', 'quantity', 'value', 'footprint', 'component', '元器件', '物料', '描述', 'description', 'reference', 'designator']
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

    // 找到关键列的索引
    let nameCol = -1
    let specCol = -1
    let qtyCol = -1

    if (headerRowIdx >= 0) {
      const header = data[headerRowIdx]
      for (let c = 0; c < header.length; c++) {
        const h = String(header[c]).toLowerCase().trim()
        if (nameCol === -1 && /名称|name|part|component|元器件|物料|designator|reference/.test(h)) {
          nameCol = c
        }
        if (specCol === -1 && /型号|规格|value|spec|description|描述|footprint|封装|model/.test(h)) {
          specCol = c
        }
        if (qtyCol === -1 && /数量|qty|quantity|count|个数|num/.test(h)) {
          qtyCol = c
        }
      }
    }

    // 如果没找到表头，把每行所有列拼起来
    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0

    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      if (!row || row.every((cell: string) => !cell || String(cell).trim() === '')) continue

      if (nameCol >= 0) {
        // 有结构化表头：提取关键列
        const name = String(row[nameCol] || '').trim()
        const spec = specCol >= 0 ? String(row[specCol] || '').trim() : ''
        const qty = qtyCol >= 0 ? String(row[qtyCol] || '1').trim() : '1'

        if (name) {
          const parts = [name]
          if (spec) parts.push(spec)
          if (qty && qty !== '1' && qty !== '0') parts.push(`x${qty}`)
          lines.push(parts.join(' '))
        }
      } else {
        // 无表头：把整行非空单元格拼起来
        const text = row
          .map((cell: string) => String(cell).trim())
          .filter((cell: string) => cell.length > 0)
          .join(' ')
        if (text) lines.push(text)
      }
    }
  }

  return lines.join('\n')
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
