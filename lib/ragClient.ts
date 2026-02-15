/**
 * RAG 后端 HTTP 客户端
 * 调用独立的 FastAPI RAG 服务
 */

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000'

export interface ChunkData {
  text: string
  metadata: {
    source: string
    page: number
    section: string
  }
}

export interface SearchResult {
  text: string
  metadata: {
    source: string
    page: number
    section: string
  }
  score: number
}

export interface ParseResponse {
  filename: string
  chunks: ChunkData[]
  total: number
}

export interface IndexResponse {
  indexed_count: number
}

export interface SearchResponse {
  results: SearchResult[]
}

export interface DeleteResponse {
  deleted_count: number
}

class RAGClient {
  private baseURL: string

  constructor(baseURL: string = RAG_SERVICE_URL) {
    this.baseURL = baseURL
  }

  /**
   * 解析文档（PDF/DOCX/TXT）
   */
  async parse(file: Buffer, filename: string): Promise<ParseResponse> {
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(file)])
    formData.append('file', blob, filename)

    const res = await fetch(`${this.baseURL}/parse`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(`RAG parse 失败: ${err.detail || res.statusText}`)
    }

    return res.json()
  }

  /**
   * 文档入库
   */
  async index(userId: string, chunks: ChunkData[]): Promise<IndexResponse> {
    const res = await fetch(`${this.baseURL}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, chunks }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(`RAG index 失败: ${err.detail || res.statusText}`)
    }

    return res.json()
  }

  /**
   * 混合检索 + rerank
   */
  async search(userId: string, query: string, topK: number = 5): Promise<SearchResult[]> {
    const res = await fetch(`${this.baseURL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, query, top_k: topK }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(`RAG search 失败: ${err.detail || res.statusText}`)
    }

    const data: SearchResponse = await res.json()
    return data.results
  }

  /**
   * 删除指定来源的文档
   */
  async delete(userId: string, source: string): Promise<DeleteResponse> {
    const res = await fetch(
      `${this.baseURL}/index/${encodeURIComponent(userId)}/${encodeURIComponent(source)}`,
      { method: 'DELETE' }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(`RAG delete 失败: ${err.detail || res.statusText}`)
    }

    return res.json()
  }

  /**
   * 健康检查
   */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseURL}/health`)
      return res.ok
    } catch {
      return false
    }
  }
}

// 单例
let _client: RAGClient | null = null

export function getRAGClient(): RAGClient {
  if (!_client) {
    _client = new RAGClient()
  }
  return _client
}
