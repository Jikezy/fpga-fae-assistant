import { ChromaClient, Collection } from 'chromadb'

export interface Document {
  id: string
  content: string
  metadata: {
    source: string
    page?: number
    title?: string
  }
}

export class VectorStore {
  private client: ChromaClient | null = null
  private collection: Collection | null = null
  private collectionName = 'fpga_documents'
  private initializationError: Error | null = null

  constructor() {
    try {
      // 使用内存模式，连接到本地Chroma服务器
      this.client = new ChromaClient({
        path: 'http://localhost:8000',
      })
    } catch (error) {
      this.initializationError = error instanceof Error ? error : new Error('Unknown initialization error')
      console.error('ChromaDB客户端初始化失败:', error)
    }
  }

  async initialize() {
    if (this.initializationError) {
      throw this.initializationError
    }

    if (!this.client) {
      throw new Error('ChromaDB客户端未初始化')
    }

    try {
      // 获取或创建集合
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { description: 'FPGA文档向量存储' },
      })
      console.log('向量存储初始化成功')
    } catch (error) {
      console.error('向量存储初始化失败:', error)
      throw new Error('无法连接到ChromaDB服务器。请确保Chroma服务器正在运行（docker run -p 8000:8000 chromadb/chroma）')
    }
  }

  async addDocuments(documents: Document[]) {
    if (!this.collection) {
      await this.initialize()
    }

    try {
      await this.collection!.add({
        ids: documents.map((doc) => doc.id),
        documents: documents.map((doc) => doc.content),
        metadatas: documents.map((doc) => doc.metadata),
      })
      console.log(`成功添加 ${documents.length} 个文档片段`)
    } catch (error) {
      console.error('添加文档失败:', error)
      throw error
    }
  }

  async search(query: string, topK: number = 5): Promise<Document[]> {
    if (!this.collection) {
      await this.initialize()
    }

    try {
      const results = await this.collection!.query({
        queryTexts: [query],
        nResults: topK,
      })

      if (!results.ids[0] || !results.documents[0] || !results.metadatas[0]) {
        return []
      }

      return results.ids[0].map((id, index) => ({
        id: id as string,
        content: results.documents[0][index] as string,
        metadata: results.metadatas[0][index] as Document['metadata'],
      }))
    } catch (error) {
      console.error('搜索失败:', error)
      return []
    }
  }

  async deleteCollection() {
    if (!this.client) {
      return
    }

    try {
      await this.client.deleteCollection({ name: this.collectionName })
      this.collection = null
      console.log('集合已删除')
    } catch (error) {
      console.error('删除集合失败:', error)
    }
  }

  async listDocuments(): Promise<string[]> {
    if (!this.collection) {
      await this.initialize()
    }

    try {
      const results = await this.collection!.get()
      return results.ids
    } catch (error) {
      console.error('获取文档列表失败:', error)
      return []
    }
  }
}

// 单例模式
let vectorStoreInstance: VectorStore | null = null

export function getVectorStore(): VectorStore {
  if (!vectorStoreInstance) {
    try {
      vectorStoreInstance = new VectorStore()
    } catch (error) {
      console.error('创建VectorStore实例失败:', error)
      throw error
    }
  }
  return vectorStoreInstance
}
