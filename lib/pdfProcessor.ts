import { Document } from './simpleVectorStore'

// 延迟导入 pdf-parse 以避免在模块加载时触发问题
async function getPdfParser() {
  const pdf = await import('pdf-parse')
  return pdf.default
}

export interface ProcessedPDF {
  title: string
  totalPages: number
  documents: Document[]
}

/**
 * 将PDF文件处理为文档片段
 */
export async function processPDF(
  buffer: Buffer,
  filename: string
): Promise<ProcessedPDF> {
  try {
    // 验证 buffer 是否有效
    if (!buffer || buffer.length === 0) {
      throw new Error('无效的PDF文件数据')
    }

    // 验证是否为PDF文件
    if (!isPDF(buffer)) {
      throw new Error('文件不是有效的PDF格式')
    }

    console.log(`开始处理PDF: ${filename}, 大小: ${buffer.length} 字节`)

    // 动态导入并使用 pdf-parse
    const pdf = await getPdfParser()
    const data = await pdf(buffer)

    console.log(`PDF解析成功: ${filename}, 页数: ${data.numpages}, 文本长度: ${data.text.length}`)

    // 分割文本为段落（每500字符一个片段，保持上下文）
    const chunkSize = 500
    const overlap = 100
    const chunks: string[] = []

    const text = data.text.replace(/\s+/g, ' ').trim()

    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.slice(i, i + chunkSize)
      if (chunk.length > 50) {
        // 过滤太短的片段
        chunks.push(chunk)
      }
    }

    console.log(`PDF分块完成: ${filename}, 共${chunks.length}个片段`)

    // 创建文档对象
    const documents: Document[] = chunks.map((chunk, index) => ({
      id: `${filename}_chunk_${index}`,
      content: chunk,
      metadata: {
        source: filename,
        page: Math.floor((index * (chunkSize - overlap)) / (data.text.length / data.numpages)),
        title: filename,
      },
    }))

    return {
      title: filename,
      totalPages: data.numpages,
      documents,
    }
  } catch (error) {
    console.error('PDF处理失败:', filename, error)
    // 提供更详细的错误信息
    if (error instanceof Error) {
      throw new Error(`PDF文件处理失败: ${error.message}`)
    }
    throw new Error('PDF文件处理失败，请确保文件格式正确且未损坏')
  }
}

/**
 * 验证文件是否为PDF
 */
export function isPDF(buffer: Buffer): boolean {
  // PDF文件以 %PDF- 开头
  const header = buffer.slice(0, 5).toString()
  return header === '%PDF-'
}

/**
 * 获取文件大小（MB）
 */
export function getFileSizeMB(buffer: Buffer): number {
  return buffer.length / (1024 * 1024)
}
