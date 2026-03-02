import { getSql, initializeDatabase } from './db-schema'
import { GraphRagEngine, GraphSignal, IndexableDocument } from './graph-rag'

export interface Document {
  id: string
  content: string
  metadata: {
    source: string
    page?: number
    title?: string
  }
}

export interface SearchScoredDocument extends Document {
  score: number
  lexicalScore: number
  graphScore: number
  matchedEntities: string[]
}

interface DocumentRow {
  id: string
  content: string
  source: string
  page: number | null
  title: string | null
}

interface FtsRow extends DocumentRow {
  fts_rank: number | string | null
}

interface GroupedDocumentRow {
  source: string
  chunks: number | string
  uploaded_at: string | Date
}

const VISION_QUERY_KEYWORDS = [
  'diagram',
  'timing',
  'waveform',
  'pinout',
  'table',
  'figure',
  'chart',
  'schematic',
  'block',
  'signal',
  'register',
  '图',
  '表',
  '时序',
  '引脚',
  '波形',
]

const VISION_DOC_MARKERS = [
  '[Vision chunk',
  '[Multimodal digest',
  'Title:',
  'Summary:',
]

const GENERAL_QUESTION_RE =
  /what|overview|summary|about|document|pdf|how many|count|什么|内容|讲什么|多少|几个|哪些|文档|概述|介绍/i

const INSERT_BATCH_SIZE = 90
const QUERY_CACHE_TTL_MS = 60 * 1000

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return 0
}

function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
  if (arr.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize))
  }
  return chunks
}

interface CachedSearchResult {
  expiresAt: number
  results: SearchScoredDocument[]
}

export class SimpleVectorStore {
  private initialized = false
  private readonly graphRag = new GraphRagEngine()
  private readonly queryCache = new Map<string, CachedSearchResult>()

  constructor() {}

  async initialize() {
    if (this.initialized) return

    try {
      await initializeDatabase()
      this.initialized = true
      console.log('Vector store initialized (Postgres + GraphRAG)')
    } catch (error) {
      console.error('Vector store initialization failed:', error)
      throw error
    }
  }

  async addDocuments(documents: Document[], userId: string) {
    if (documents.length === 0) return

    try {
      const scopedDocuments = documents.map((doc) => ({
        ...doc,
        id: doc.id.startsWith(`${userId}:`) ? doc.id : `${userId}:${doc.id}`,
      }))

      await this.bulkUpsertDocuments(scopedDocuments, userId)

      try {
        await this.graphRag.upsertDocuments(
          scopedDocuments as IndexableDocument[],
          userId
        )
      } catch (graphError) {
        console.warn('GraphRAG indexing failed, fallback to lexical only:', graphError)
      }

      this.invalidateQueryCache(userId)
      console.log(`Added ${documents.length} document chunks for user ${userId}`)
    } catch (error) {
      console.error('Failed to add documents:', error)
      throw error
    }
  }

  async search(
    query: string,
    topK: number = 5,
    userId?: string
  ): Promise<Document[]> {
    const scored = await this.searchWithGraph(query, topK, userId)
    return scored.map((item) => ({
      id: item.id,
      content: item.content,
      metadata: item.metadata,
    }))
  }

  async searchLexicalBaseline(
    query: string,
    topK: number = 5,
    userId?: string
  ): Promise<SearchScoredDocument[]> {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return []

    const safeTopK = Math.max(1, Math.floor(topK))
    const legacyResults = await this.searchLegacy(normalizedQuery, safeTopK, userId)
    return legacyResults.slice(0, Math.max(safeTopK, safeTopK * 2))
  }

  async searchWithGraph(
    query: string,
    topK: number = 5,
    userId?: string
  ): Promise<SearchScoredDocument[]> {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return []

    const safeTopK = Math.max(1, Math.floor(topK))
    const cacheKey = userId
      ? `user:${userId}:topk:${safeTopK}:q:${normalizedQuery.toLowerCase()}`
      : ''

    if (cacheKey) {
      const cached = this.queryCache.get(cacheKey)
      if (cached && cached.expiresAt > Date.now()) {
        return cached.results
      }
      if (cached) {
        this.queryCache.delete(cacheKey)
      }
    }

    try {
      const lexicalCandidates = await this.fetchLexicalCandidates(
        normalizedQuery,
        Math.max(safeTopK * 10, 40),
        userId
      )

      let graphSignals = new Map<string, GraphSignal>()
      if (userId) {
        try {
          graphSignals = await this.graphRag.collectSignals(
            normalizedQuery,
            userId,
            Math.max(safeTopK * 12, 50)
          )
        } catch (graphError) {
          console.warn('GraphRAG retrieval failed, fallback to lexical only:', graphError)
        }
      }

      const docMap = new Map<
        string,
        { doc: Document; ftsScore: number; graph: GraphSignal | null }
      >()

      lexicalCandidates.forEach((candidate) => {
        docMap.set(candidate.doc.id, {
          doc: candidate.doc,
          ftsScore: candidate.ftsScore,
          graph: graphSignals.get(candidate.doc.id) || null,
        })
      })

      const missingGraphIds = [...graphSignals.keys()].filter(
        (id) => !docMap.has(id)
      )
      if (missingGraphIds.length > 0) {
        const missingDocs = await this.fetchDocumentsByIds(missingGraphIds, userId)
        missingDocs.forEach((doc) => {
          docMap.set(doc.id, {
            doc,
            ftsScore: 0,
            graph: graphSignals.get(doc.id) || null,
          })
        })
      }

      if (docMap.size === 0) {
        const fallback = await this.searchLegacy(normalizedQuery, safeTopK, userId)
        this.saveCache(cacheKey, fallback)
        return fallback
      }

      const queryTerms = this.tokenize(normalizedQuery)
      const visualIntent = this.isVisualIntentQuery(normalizedQuery)
      const maxFtsScore = Math.max(
        1e-6,
        ...[...docMap.values()].map((item) => item.ftsScore)
      )

      const graphRawScores = new Map<string, number>()
      docMap.forEach((item, id) => {
        const signal = item.graph
        if (!signal) {
          graphRawScores.set(id, 0)
          return
        }
        const raw =
          signal.directScore * 0.68 +
          signal.neighborScore * 0.32 +
          signal.directHits * 0.14 +
          signal.neighborHits * 0.08
        graphRawScores.set(id, raw)
      })
      const maxGraphRawScore = Math.max(
        1e-6,
        ...[...graphRawScores.values()].map((score) => score)
      )

      const scoredResults: SearchScoredDocument[] = []

      docMap.forEach((item, id) => {
        const docTerms = this.tokenize(item.doc.content)
        const similarity = this.calculateSimilarity(queryTerms, docTerms)
        const normalizedFts = item.ftsScore / maxFtsScore
        const graphRaw = graphRawScores.get(id) || 0
        const normalizedGraph = graphRaw / maxGraphRawScore
        const visualBoost = this.applyQueryAwareBoost(0, item.doc, visualIntent)

        const lexicalScore = similarity * 0.74 + normalizedFts * 0.26
        const finalScore =
          lexicalScore * 0.58 + normalizedGraph * 0.35 + visualBoost + 0.01

        if (finalScore <= 0.006) {
          return
        }

        scoredResults.push({
          ...item.doc,
          score: finalScore,
          lexicalScore,
          graphScore: normalizedGraph,
          matchedEntities: item.graph?.matchedEntities || [],
        })
      })

      scoredResults.sort((a, b) => b.score - a.score)
      let finalResults = this.diversifyBySource(scoredResults, safeTopK)

      if (finalResults.length < Math.min(3, safeTopK)) {
        const fallback = await this.searchLegacy(normalizedQuery, safeTopK, userId)
        finalResults = this.mergeScoredResults(finalResults, fallback)
      }

      this.saveCache(cacheKey, finalResults)
      return finalResults.slice(0, Math.max(safeTopK, safeTopK * 2))
    } catch (error) {
      console.error('Document search failed:', error)
      const fallback = await this.searchLegacy(normalizedQuery, safeTopK, userId)
      this.saveCache(cacheKey, fallback)
      return fallback
    }
  }

  async deleteCollection() {
    const sql = getSql()
    try {
      await sql`DELETE FROM documents`
      this.queryCache.clear()
      console.log('Vector store cleared')
    } catch (error) {
      console.error('Failed to clear vector store:', error)
      throw error
    }
  }

  async deleteDocumentsBySource(source: string, userId: string): Promise<number> {
    const sql = getSql()
    try {
      const rows = await sql`
        WITH deleted_rows AS (
          DELETE FROM documents
          WHERE source = ${source} AND user_id = ${userId}
          RETURNING 1
        )
        SELECT COUNT(*)::bigint AS deleted_count
        FROM deleted_rows
      `
      const deletedCount = toFiniteNumber(
        (rows[0] as { deleted_count?: number | string })?.deleted_count
      )
      this.invalidateQueryCache(userId)
      console.log(`Deleted ${deletedCount} chunks from source ${source} for user ${userId}`)
      return deletedCount
    } catch (error) {
      console.error('Failed to delete documents by source:', error)
      throw error
    }
  }

  async listDocuments(
    userId?: string
  ): Promise<Array<{ source: string; uploadedAt: Date; chunks: number }>> {
    const sql = getSql()

    try {
      const rows = userId
        ? await sql`
            SELECT
              source,
              COUNT(*) as chunks,
              MIN(created_at) as uploaded_at
            FROM documents
            WHERE user_id = ${userId}
            GROUP BY source
            ORDER BY uploaded_at DESC
          `
        : await sql`
            SELECT
              source,
              COUNT(*) as chunks,
              MIN(created_at) as uploaded_at
            FROM documents
            GROUP BY source
            ORDER BY uploaded_at DESC
          `

      return rows.map((row) => {
        const typedRow = row as GroupedDocumentRow
        return {
          source: typedRow.source,
          uploadedAt: new Date(typedRow.uploaded_at),
          chunks: Number(typedRow.chunks),
        }
      })
    } catch (error) {
      console.error('Failed to list documents:', error)
      return []
    }
  }

  private async bulkUpsertDocuments(documents: Document[], userId: string) {
    const sql = getSql()
    const chunks = chunkArray(documents, INSERT_BATCH_SIZE)

    for (const docsChunk of chunks) {
      if (docsChunk.length === 0) continue

      const valuesSql: string[] = []
      const params: Array<string | number | null> = []

      docsChunk.forEach((doc, index) => {
        const offset = index * 6
        valuesSql.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`
        )
        params.push(
          doc.id,
          doc.content,
          doc.metadata.source,
          doc.metadata.page || null,
          doc.metadata.title || null,
          userId
        )
      })

      await sql(
        `INSERT INTO documents (id, content, source, page, title, user_id)
        VALUES ${valuesSql.join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          source = EXCLUDED.source,
          page = EXCLUDED.page,
          title = EXCLUDED.title,
          user_id = EXCLUDED.user_id`,
        params
      )
    }
  }

  private async fetchLexicalCandidates(
    query: string,
    limit: number,
    userId?: string
  ): Promise<Array<{ doc: Document; ftsScore: number }>> {
    const sql = getSql()
    const safeLimit = Math.max(10, Math.floor(limit))

    try {
      let rows: FtsRow[] = []

      if (userId) {
        rows = (await sql(
          `SELECT
            id,
            content,
            source,
            page,
            title,
            ts_rank_cd(
              to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, '')),
              plainto_tsquery('simple', $2)
            )::float AS fts_rank
          FROM documents
          WHERE
            user_id = $1
            AND to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, ''))
              @@ plainto_tsquery('simple', $2)
          ORDER BY fts_rank DESC, created_at ASC
          LIMIT $3`,
          [userId, query, safeLimit]
        )) as FtsRow[]
      } else {
        rows = (await sql(
          `SELECT
            id,
            content,
            source,
            page,
            title,
            ts_rank_cd(
              to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, '')),
              plainto_tsquery('simple', $1)
            )::float AS fts_rank
          FROM documents
          WHERE
            to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, ''))
              @@ plainto_tsquery('simple', $1)
          ORDER BY fts_rank DESC, created_at ASC
          LIMIT $2`,
          [query, safeLimit]
        )) as FtsRow[]
      }

      const primaryResults = rows.map((row) => ({
        doc: this.toDocument(row),
        ftsScore: toFiniteNumber(row.fts_rank),
      }))

      if (primaryResults.length >= Math.min(15, safeLimit / 2)) {
        return primaryResults
      }

      const likeFallback = await this.fetchLikeCandidates(
        query,
        safeLimit,
        userId
      )
      return this.mergeLexicalCandidates(primaryResults, likeFallback)
    } catch (error) {
      console.warn('FTS search failed, fallback to LIKE search only:', error)
      return this.fetchLikeCandidates(query, safeLimit, userId)
    }
  }

  private async fetchLikeCandidates(
    query: string,
    limit: number,
    userId?: string
  ): Promise<Array<{ doc: Document; ftsScore: number }>> {
    const sql = getSql()
    const terms = [...new Set(this.tokenize(query))].slice(0, 6)
    if (terms.length === 0) {
      return []
    }

    const likePatterns = terms.map((term) => `%${term}%`)
    const safeLimit = Math.max(8, Math.floor(limit))

    const buildLikeCase = (startIndex: number) =>
      likePatterns
        .map(
          (_, idx) =>
            `CASE WHEN LOWER(content) LIKE LOWER($${startIndex + idx}) THEN 1 ELSE 0 END`
        )
        .join(' + ')

    const buildOrClause = (startIndex: number) =>
      likePatterns
        .map((_, idx) => `LOWER(content) LIKE LOWER($${startIndex + idx})`)
        .join(' OR ')

    let rows: FtsRow[] = []
    if (userId) {
      const likeStart = 2
      const limitIndex = likeStart + likePatterns.length
      const scoreExpr = buildLikeCase(likeStart)
      const orExpr = buildOrClause(likeStart)
      rows = (await sql(
        `SELECT
          id,
          content,
          source,
          page,
          title,
          (${scoreExpr})::float AS fts_rank
        FROM documents
        WHERE user_id = $1 AND (${orExpr})
        ORDER BY fts_rank DESC, created_at ASC
        LIMIT $${limitIndex}`,
        [userId, ...likePatterns, safeLimit]
      )) as FtsRow[]
    } else {
      const likeStart = 1
      const limitIndex = likeStart + likePatterns.length
      const scoreExpr = buildLikeCase(likeStart)
      const orExpr = buildOrClause(likeStart)
      rows = (await sql(
        `SELECT
          id,
          content,
          source,
          page,
          title,
          (${scoreExpr})::float AS fts_rank
        FROM documents
        WHERE (${orExpr})
        ORDER BY fts_rank DESC, created_at ASC
        LIMIT $${limitIndex}`,
        [...likePatterns, safeLimit]
      )) as FtsRow[]
    }

    return rows.map((row) => ({
      doc: this.toDocument(row),
      ftsScore: toFiniteNumber(row.fts_rank) * 0.25,
    }))
  }

  private mergeLexicalCandidates(
    first: Array<{ doc: Document; ftsScore: number }>,
    second: Array<{ doc: Document; ftsScore: number }>
  ): Array<{ doc: Document; ftsScore: number }> {
    const merged = new Map<string, { doc: Document; ftsScore: number }>()
    ;[...first, ...second].forEach((item) => {
      const existing = merged.get(item.doc.id)
      if (!existing || item.ftsScore > existing.ftsScore) {
        merged.set(item.doc.id, item)
      }
    })
    return [...merged.values()]
  }

  private async fetchDocumentsByIds(
    ids: string[],
    userId?: string
  ): Promise<Document[]> {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return []

    const sql = getSql()
    const chunks = chunkArray(uniqueIds, 120)
    const allDocs: Document[] = []

    for (const idChunk of chunks) {
      const placeholders = idChunk
        .map((_, index) => `$${index + 1}`)
        .join(', ')
      const params: Array<string | number> = [...idChunk]
      let userClause = ''
      if (userId) {
        params.push(userId)
        userClause = ` AND user_id = $${params.length}`
      }

      const rows = (await sql(
        `SELECT id, content, source, page, title
        FROM documents
        WHERE id IN (${placeholders})${userClause}`,
        params
      )) as DocumentRow[]

      rows.forEach((row) => {
        allDocs.push(this.toDocument(row))
      })
    }

    return allDocs
  }

  private async searchLegacy(
    query: string,
    topK: number,
    userId?: string
  ): Promise<SearchScoredDocument[]> {
    const documents = await this.fetchAllDocuments(userId)
    if (documents.length === 0) {
      return []
    }

    const docsBySource = new Map<string, Document[]>()
    for (const doc of documents) {
      const source = doc.metadata.source
      if (!docsBySource.has(source)) {
        docsBySource.set(source, [])
      }
      docsBySource.get(source)!.push(doc)
    }

    const isGeneralQuestion = GENERAL_QUESTION_RE.test(query)
    if (isGeneralQuestion) {
      const perDocLimit = Math.max(2, Math.ceil(topK / Math.max(1, docsBySource.size)))
      const results: SearchScoredDocument[] = []
      docsBySource.forEach((docs) => {
        docs.slice(0, perDocLimit).forEach((doc) => {
          results.push({
            ...doc,
            score: 0.06,
            lexicalScore: 0.06,
            graphScore: 0,
            matchedEntities: [],
          })
        })
      })
      return results.slice(0, Math.max(topK, topK * 2))
    }

    const queryTerms = this.tokenize(query)
    const visualIntent = this.isVisualIntentQuery(query)
    const scored: SearchScoredDocument[] = []

    for (const doc of documents) {
      const docTerms = this.tokenize(doc.content)
      const similarity = this.calculateSimilarity(queryTerms, docTerms)
      const boosted = this.applyQueryAwareBoost(similarity, doc, visualIntent)
      const scoreThreshold = visualIntent ? 0.003 : 0.005
      if (boosted > scoreThreshold) {
        scored.push({
          ...doc,
          score: boosted,
          lexicalScore: boosted,
          graphScore: 0,
          matchedEntities: [],
        })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return this.diversifyBySource(scored, topK)
  }

  private async fetchAllDocuments(userId?: string): Promise<Document[]> {
    const sql = getSql()
    const rows = userId
      ? await sql`
          SELECT id, content, source, page, title
          FROM documents
          WHERE user_id = ${userId}
          ORDER BY created_at ASC
        `
      : await sql`
          SELECT id, content, source, page, title
          FROM documents
          ORDER BY created_at ASC
        `

    return (rows as DocumentRow[]).map((row) => this.toDocument(row))
  }

  private toDocument(row: DocumentRow): Document {
    return {
      id: row.id,
      content: row.content,
      metadata: {
        source: row.source,
        page: row.page || undefined,
        title: row.title || undefined,
      },
    }
  }

  private diversifyBySource(
    scored: SearchScoredDocument[],
    topK: number
  ): SearchScoredDocument[] {
    const target = Math.max(topK, topK * 2)
    if (scored.length <= target) return scored

    const pool = [...scored]
    const selected: SearchScoredDocument[] = []
    const sourceCounter = new Map<string, number>()

    while (pool.length > 0 && selected.length < target) {
      let bestIndex = 0
      let bestAdjustedScore = -Infinity

      for (let i = 0; i < pool.length; i += 1) {
        const candidate = pool[i]
        const source = candidate.metadata.source
        const pickedCount = sourceCounter.get(source) || 0
        const adjustedScore = candidate.score - pickedCount * 0.08
        if (adjustedScore > bestAdjustedScore) {
          bestAdjustedScore = adjustedScore
          bestIndex = i
        }
      }

      const [picked] = pool.splice(bestIndex, 1)
      selected.push(picked)
      const source = picked.metadata.source
      sourceCounter.set(source, (sourceCounter.get(source) || 0) + 1)
    }

    return selected
  }

  private mergeScoredResults(
    primary: SearchScoredDocument[],
    secondary: SearchScoredDocument[]
  ): SearchScoredDocument[] {
    const merged = new Map<string, SearchScoredDocument>()
    ;[...primary, ...secondary].forEach((item) => {
      const existing = merged.get(item.id)
      if (!existing || item.score > existing.score) {
        merged.set(item.id, item)
      }
    })
    return [...merged.values()].sort((a, b) => b.score - a.score)
  }

  private saveCache(cacheKey: string, results: SearchScoredDocument[]) {
    if (!cacheKey) return
    this.queryCache.set(cacheKey, {
      expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
      results,
    })
  }

  private invalidateQueryCache(userId?: string) {
    if (!userId) {
      this.queryCache.clear()
      return
    }
    const prefix = `user:${userId}:`
    for (const key of this.queryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.queryCache.delete(key)
      }
    }
  }

  private tokenize(text: string): string[] {
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')

    const wordTokens = normalized
      .split(/\s+/)
      .filter((term) => term.length > 1)

    const cjkSequences = normalized.match(/[\u4e00-\u9fa5]{2,}/g) || []
    const cjkBiGrams: string[] = []

    for (const sequence of cjkSequences) {
      const maxBiGrams = Math.min(sequence.length - 1, 80)
      for (let i = 0; i < maxBiGrams; i += 1) {
        cjkBiGrams.push(sequence.slice(i, i + 2))
      }
    }

    return [...wordTokens, ...cjkBiGrams]
  }

  private isVisualIntentQuery(query: string): boolean {
    const normalized = query.toLowerCase()
    return VISION_QUERY_KEYWORDS.some((keyword) =>
      normalized.includes(keyword.toLowerCase())
    )
  }

  private isVisionDocument(doc: Document): boolean {
    return VISION_DOC_MARKERS.some((marker) => doc.content.includes(marker))
  }

  private applyQueryAwareBoost(
    score: number,
    doc: Document,
    visualIntent: boolean
  ): number {
    let boosted = score
    const isVisionDoc = this.isVisionDocument(doc)

    if (visualIntent && isVisionDoc) {
      boosted += 0.08
    } else if (isVisionDoc) {
      boosted += 0.015
    }

    if (visualIntent && /\[p\d+\]/i.test(doc.content)) {
      boosted += 0.01
    }

    return boosted
  }

  private calculateSimilarity(terms1: string[], terms2: string[]): number {
    if (terms1.length === 0 || terms2.length === 0) return 0

    const set1 = new Set(terms1)
    const set2 = new Set(terms2)
    const intersection = new Set([...set1].filter((term) => set2.has(term)))
    const union = new Set([...set1, ...set2])

    const jaccard = intersection.size / Math.max(1, union.size)

    let freqScore = 0
    for (const term of intersection) {
      const freq1 = terms1.filter((token) => token === term).length
      const freq2 = terms2.filter((token) => token === term).length
      freqScore += Math.min(freq1, freq2)
    }

    const normalizedFreq = freqScore / Math.max(terms1.length, terms2.length)
    return jaccard * 0.5 + normalizedFreq * 0.5
  }
}

let vectorStoreInstance: SimpleVectorStore | null = null

export function getVectorStore(): SimpleVectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new SimpleVectorStore()
  }
  return vectorStoreInstance
}
