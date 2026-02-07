import pdf from 'pdf-parse/lib/pdf-parse'
import { Document } from './simpleVectorStore'

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
    // 解析PDF - 确保传递的是 Buffer 对象
    const data = await pdf(buffer, {
      // 不要使用文件路径，只使用 buffer
      max: 0, // 不限制页数
    })

    // 分割文本为段落（每500字符一个片段，保持上下文）
    const chunkSize = 500
    const overlap = 100
    const chunks: string[] = []

    let text = data.text.replace(/\s+/g, ' ').trim()

    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.slice(i, i + chunkSize)
      if (chunk.length > 50) {
        // 过滤太短的片段
        chunks.push(chunk)
      }
    }

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
    console.error('PDF处理失败:', error)
    throw new Error('PDF文件处理失败，请确保文件格式正确')
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
