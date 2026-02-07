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
    // 验证 buffer 是否有效
    if (!buffer || buffer.length === 0) {
      throw new Error('无效的PDF文件数据')
    }

    // 验证是否为PDF文件
    if (!isPDF(buffer)) {
      throw new Error('文件不是有效的PDF格式')
    }

    console.log(`开始处理PDF: ${filename}, 大小: ${buffer.length} 字节`)

    // 动态导入 pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

    // 将 Buffer 转换为 Uint8Array
    const data = new Uint8Array(buffer)

    // 加载 PDF 文档，禁用 worker
    const loadingTask = pdfjsLib.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    })
    const pdfDocument = await loadingTask.promise

    const totalPages = pdfDocument.numPages
    console.log(`PDF加载成功: ${filename}, 页数: ${totalPages}`)

    // 提取所有页面的文本
    let fullText = ''
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      fullText += pageText + ' '
    }

    console.log(`PDF文本提取成功: ${filename}, 文本长度: ${fullText.length}`)

    // 分割文本为段落（每500字符一个片段，保持上下文）
    const chunkSize = 500
    const overlap = 100
    const chunks: string[] = []

    const text = fullText.replace(/\s+/g, ' ').trim()

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
        page: Math.floor((index * (chunkSize - overlap)) / (text.length / totalPages)),
        title: filename,
      },
    }))

    return {
      title: filename,
      totalPages,
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
