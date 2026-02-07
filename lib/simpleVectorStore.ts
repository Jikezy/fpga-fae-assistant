export interface Document {
  id: string
  content: string
  metadata: {
    source: string
    page?: number
    title?: string
  }
}

// 使用全局变量确保数据在 Next.js 热重载时不丢失
const globalForVectorStore = global as unknown as {
  vectorStoreDocuments: Map<string, Document> | undefined
}

/**
 * 简单的内存向量存储
 * 使用 TF-IDF 和余弦相似度进行文档检索
 */
export class SimpleVectorStore {
  private documents: Map<string, Document>
  private initialized: boolean = false

  constructor() {
    // 使用全局变量确保在 Next.js 开发模式下数据持久化
    if (!globalForVectorStore.vectorStoreDocuments) {
      globalForVectorStore.vectorStoreDocuments = new Map()
    }
    this.documents = globalForVectorStore.vectorStoreDocuments
  }

  async initialize() {
    this.initialized = true
    console.log('简单向量存储初始化成功')
  }

  async addDocuments(documents: Document[]) {
    for (const doc of documents) {
      this.documents.set(doc.id, doc)
    }
    console.log(`成功添加 ${documents.length} 个文档片段，总计 ${this.documents.size} 个`)
  }

  /**
   * 简单的文本相似度搜索
   * 使用关键词匹配和文本重叠度
   */
  async search(query: string, topK: number = 5): Promise<Document[]> {
    // 如果是泛泛的询问（比如"pdf讲的什么"），返回前面的文档片段作为概览
    const generalQuestions = ['什么', 'what', '内容', 'content', '讲', '关于', 'about']
    const isGeneralQuestion = generalQuestions.some(keyword =>
      query.toLowerCase().includes(keyword)
    ) && query.length < 20 // 短问题通常是泛泛的询问

    if (isGeneralQuestion && this.documents.size > 0) {
      console.log('检测到泛泛询问，返回文档概览')
      // 返回前面的几个文档片段
      const docs = Array.from(this.documents.values())
      return docs.slice(0, Math.min(topK, docs.length))
    }

    const queryTerms = this.tokenize(query.toLowerCase())
    const results: Array<{ doc: Document; score: number }> = []

    for (const doc of this.documents.values()) {
      const docTerms = this.tokenize(doc.content.toLowerCase())
      const score = this.calculateSimilarity(queryTerms, docTerms)

      // 降低阈值，让更多文档能被匹配
      if (score > 0.01) {  // 从 > 0 改为 > 0.01，避免完全不相关的内容
        results.push({ doc, score })
      }
    }

    // 按相似度排序并返回前 topK 个结果
    results.sort((a, b) => b.score - a.score)

    const topResults = results.slice(0, topK).map(r => r.doc)

    // 如果没找到足够的结果，返回前几个文档作为fallback
    if (topResults.length < 3 && this.documents.size > 0) {
      console.log('未找到足够的匹配文档，返回前几个文档作为fallback')
      const docs = Array.from(this.documents.values())
      return docs.slice(0, Math.min(topK, docs.length))
    }

    return topResults
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
    this.documents.clear()
    console.log('向量存储已清空')
  }

  async deleteDocumentsBySource(source: string): Promise<number> {
    let deletedCount = 0
    const keysToDelete: string[] = []

    // 找出所有属于该文件的文档
    for (const [id, doc] of this.documents.entries()) {
      if (doc.metadata.source === source) {
        keysToDelete.push(id)
      }
    }

    // 删除这些文档
    for (const key of keysToDelete) {
      this.documents.delete(key)
      deletedCount++
    }

    console.log(`已删除 ${source} 的 ${deletedCount} 个文档片段`)
    return deletedCount
  }

  async listDocuments(): Promise<string[]> {
    return Array.from(this.documents.keys())
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
