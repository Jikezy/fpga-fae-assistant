import { getSql, initializeDatabase } from './db-schema'

export interface Document {
  id: string
  content: string
  metadata: {
    source: string
    page?: number
    title?: string
  }
}

/**
 * 持久化向量存储（使用 Neon Postgres）
 * 使用 TF-IDF 和余弦相似度进行文档检索
 */
export class SimpleVectorStore {
  private initialized: boolean = false

  constructor() {}

  async initialize() {
    if (this.initialized) return

    try {
      // 初始化数据库表结构
      await initializeDatabase()
      this.initialized = true
      console.log('向量存储初始化成功（Postgres）')
    } catch (error) {
      console.error('向量存储初始化失败:', error)
      throw error
    }
  }

  async addDocuments(documents: Document[]) {
    const sql = getSql()

    try {
      // 批量插入文档到数据库
      for (const doc of documents) {
        await sql`
          INSERT INTO documents (id, content, source, page, title)
          VALUES (
            ${doc.id},
            ${doc.content},
            ${doc.metadata.source},
            ${doc.metadata.page || null},
            ${doc.metadata.title || null}
          )
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            source = EXCLUDED.source,
            page = EXCLUDED.page,
            title = EXCLUDED.title
        `
      }

      console.log(`成功添加 ${documents.length} 个文档片段到数据库`)
    } catch (error) {
      console.error('添加文档失败:', error)
      throw error
    }
  }

  /**
   * 简单的文本相似度搜索
   * 使用关键词匹配和文本重叠度
   */
  async search(query: string, topK: number = 5): Promise<Document[]> {
    const sql = getSql()

    try {
      // 从数据库读取所有文档
      const rows = await sql`
        SELECT id, content, source, page, title
        FROM documents
        ORDER BY created_at ASC
      `

      if (rows.length === 0) {
        console.log('数据库中没有文档')
        return []
      }

      // 转换为Document格式
      const documents: Document[] = rows.map((row: any) => ({
        id: row.id,
        content: row.content,
        metadata: {
          source: row.source,
          page: row.page || undefined,
          title: row.title || undefined,
        },
      }))

      console.log(`从数据库加载了 ${documents.length} 个文档`)

      // 如果是泛泛的询问（比如"pdf讲的什么"），返回前面的文档片段作为概览
      const generalQuestions = ['什么', 'what', '内容', 'content', '讲', '关于', 'about']
      const isGeneralQuestion = generalQuestions.some(keyword =>
        query.toLowerCase().includes(keyword)
      ) && query.length < 20

      if (isGeneralQuestion) {
        console.log('检测到泛泛询问，返回文档概览')
        return documents.slice(0, Math.min(topK, documents.length))
      }

      const queryTerms = this.tokenize(query.toLowerCase())
      const results: Array<{ doc: Document; score: number }> = []

      for (const doc of documents) {
        const docTerms = this.tokenize(doc.content.toLowerCase())
        const score = this.calculateSimilarity(queryTerms, docTerms)

        if (score > 0.01) {
          results.push({ doc, score })
        }
      }

      // 按相似度排序并返回前 topK 个结果
      results.sort((a, b) => b.score - a.score)

      const topResults = results.slice(0, topK).map(r => r.doc)

      // 如果没找到足够的结果，返回前几个文档作为fallback
      if (topResults.length < 3 && documents.length > 0) {
        console.log('未找到足够的匹配文档，返回前几个文档作为fallback')
        return documents.slice(0, Math.min(topK, documents.length))
      }

      return topResults
    } catch (error) {
      console.error('搜索文档失败:', error)
      throw error
    }
  }

  /**
   * 简单的分词
   */
  private tokenize(text: string): string[] {
    // 移除标点符号并分词
    return text
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 1)
  }

  /**
   * 计算两个词项集合的相似度
   * 使用 Jaccard 相似度 + 词频权重
   */
  private calculateSimilarity(terms1: string[], terms2: string[]): number {
    if (terms1.length === 0 || terms2.length === 0) return 0

    const set1 = new Set(terms1)
    const set2 = new Set(terms2)

    // 计算交集
    const intersection = new Set([...set1].filter(x => set2.has(x)))

    // Jaccard 相似度
    const union = new Set([...set1, ...set2])
    const jaccard = intersection.size / union.size

    // 词频权重：共同词在两个文本中出现的次数
    let freqScore = 0
    for (const term of intersection) {
      const freq1 = terms1.filter(t => t === term).length
      const freq2 = terms2.filter(t => t === term).length
      freqScore += Math.min(freq1, freq2)
    }

    // 归一化词频得分
    const normalizedFreq = freqScore / Math.max(terms1.length, terms2.length)

    // 综合得分：Jaccard 相似度和词频权重各占50%
    return jaccard * 0.5 + normalizedFreq * 0.5
  }

  async deleteCollection() {
    const sql = getSql()
    try {
      await sql`DELETE FROM documents`
      console.log('向量存储已清空')
    } catch (error) {
      console.error('清空向量存储失败:', error)
      throw error
    }
  }

  async deleteDocumentsBySource(source: string): Promise<number> {
    const sql = getSql()
    try {
      const result = await sql`
        DELETE FROM documents
        WHERE source = ${source}
      `
      const deletedCount = result.length || 0
      console.log(`已删除 ${source} 的 ${deletedCount} 个文档片段`)
      return deletedCount
    } catch (error) {
      console.error('删除文档失败:', error)
      throw error
    }
  }

  async listDocuments(): Promise<string[]> {
    const sql = getSql()
    try {
      const rows = await sql`
        SELECT DISTINCT source FROM documents
        ORDER BY created_at DESC
      `
      return rows.map((row: any) => row.source)
    } catch (error) {
      console.error('列出文档失败:', error)
      // 如果数据库查询失败，返回空数组
      return []
    }
  }
}

// 单例模式
let vectorStoreInstance: SimpleVectorStore | null = null

export function getVectorStore(): SimpleVectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new SimpleVectorStore()
  }
  return vectorStoreInstance
}
