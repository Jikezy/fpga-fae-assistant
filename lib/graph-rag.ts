import { createHash } from 'crypto'
import { getSql } from './db-schema'

export interface IndexableDocument {
  id: string
  content: string
  metadata: {
    source: string
    page?: number
    title?: string
  }
}

type EntityType = 'tech' | 'parameter' | 'phrase'

interface EntityCandidate {
  norm: string
  value: string
  type: EntityType
  score: number
  count: number
}

interface GraphEntityRow {
  id: string
  documentId: string
  userId: string
  source: string
  page: number | null
  entityValue: string
  entityNorm: string
  entityType: EntityType
  weight: number
}

interface GraphEdgeRow {
  id: string
  documentId: string
  userId: string
  source: string
  page: number | null
  fromEntity: string
  toEntity: string
  relation: string
  weight: number
}

interface DirectSignalRow {
  document_id: string
  signal_score: number | string | null
  hit_count: number | string | null
  matched_norms: unknown
  matched_entities: unknown
}

interface NeighborEntityRow {
  neighbor_entity: string
  edge_score: number | string | null
}

export interface GraphSignal {
  directScore: number
  directHits: number
  neighborScore: number
  neighborHits: number
  matchedEntities: string[]
}

const BULK_INSERT_BATCH_SIZE = 120
const MAX_ENTITY_PER_DOC = 18
const MAX_EDGE_ENTITY_PER_DOC = 10
const MAX_QUERY_ENTITY = 12

const TECH_HINTS = new Set([
  'fpga',
  'pll',
  'adc',
  'dac',
  'gpio',
  'uart',
  'spi',
  'i2c',
  'i2s',
  'pcie',
  'ddr',
  'register',
  'clock',
  'timing',
  'waveform',
  'pin',
  'signal',
  'voltage',
  'current',
  'latency',
  'jtag',
  '复位',
  '时钟',
  '时序',
  '寄存器',
  '引脚',
  '波形',
  '电压',
  '电流',
  '协议',
  '约束',
  '采样',
  '频率',
  '带宽',
])

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'have',
  'into',
  'through',
  'then',
  'than',
  'will',
  'should',
  'about',
  'which',
  'where',
  'when',
  'what',
  'how',
  'please',
  '文档',
  '内容',
  '问题',
  '说明',
  '分析',
  '这个',
  '那个',
  '一个',
  '可以',
  '需要',
  '以及',
  '然后',
  '并且',
])

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

function parseTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (typeof value !== 'string') {
    return []
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return []
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const body = trimmed.slice(1, -1).trim()
    if (!body) {
      return []
    }
    return body
      .split(',')
      .map((part) => part.trim().replace(/^"+|"+$/g, ''))
      .filter(Boolean)
  }

  return trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function stableId(parts: string[]): string {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 24)
}

function normalizeEntityToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5./%+-]/g, '')
    .replace(/^[_./%+\-]+|[_./%+\-]+$/g, '')
    .trim()
}

function classifyEntityType(raw: string, normalized: string): EntityType {
  if (/\d/.test(normalized) && /(v|a|hz|khz|mhz|ghz|ns|us|ms|ohm|ω|%|℃|°c)/i.test(normalized)) {
    return 'parameter'
  }
  if (/[\u4e00-\u9fa5]/.test(raw)) {
    return 'phrase'
  }
  return 'tech'
}

function shouldKeepEntity(normalized: string, type: EntityType): boolean {
  if (!normalized) return false
  if (normalized.length < 2 || normalized.length > 40) return false
  if (STOPWORDS.has(normalized)) return false
  if (type !== 'parameter' && /^[0-9]+$/.test(normalized)) return false
  if (type === 'phrase' && normalized.length < 2) return false
  return true
}

function addCandidate(
  bucket: Map<string, EntityCandidate>,
  raw: string,
  baseScore: number
) {
  const normalized = normalizeEntityToken(raw)
  const entityType = classifyEntityType(raw, normalized)
  if (!shouldKeepEntity(normalized, entityType)) {
    return
  }

  const existing = bucket.get(normalized)
  if (existing) {
    existing.count += 1
    existing.score += baseScore
    if (raw.length > existing.value.length) {
      existing.value = raw
    }
    return
  }

  bucket.set(normalized, {
    norm: normalized,
    value: raw,
    type: entityType,
    score: baseScore,
    count: 1,
  })
}

function extractEntities(text: string, maxEntities: number): EntityCandidate[] {
  const candidates = new Map<string, EntityCandidate>()

  const parameterMatches =
    text.match(
      /\b\d+(?:\.\d+)?\s?(?:v|mv|a|ma|hz|khz|mhz|ghz|ns|us|ms|ohm|Ω|%|℃|°c)\b/gi
    ) || []
  parameterMatches.forEach((token) => addCandidate(candidates, token, 2.4))

  const englishMatches = text.match(/[A-Za-z][A-Za-z0-9_./-]{2,}/g) || []
  englishMatches.forEach((token) => {
    const hasMixedDigit = /\d/.test(token) && /[a-z]/i.test(token)
    addCandidate(candidates, token, hasMixedDigit ? 1.9 : 1.2)
  })

  const chineseMatches = text.match(/[\u4e00-\u9fa5]{2,8}/g) || []
  chineseMatches.forEach((token) => addCandidate(candidates, token, 1.1))

  const scored = [...candidates.values()].map((item) => {
    let score = item.score + Math.log2(item.count + 1)

    if (item.type === 'parameter') {
      score += 1.1
    }
    if (TECH_HINTS.has(item.norm)) {
      score += 1.3
    }
    if (/\d/.test(item.norm) && /[a-z]/i.test(item.norm)) {
      score += 0.6
    }
    if (item.norm.length >= 4 && item.norm.length <= 18) {
      score += 0.35
    }

    return {
      ...item,
      score,
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxEntities)
}

function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
  if (arr.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize))
  }
  return chunks
}

export class GraphRagEngine {
  async upsertDocuments(documents: IndexableDocument[], userId: string) {
    if (documents.length === 0) return

    const sql = getSql()
    const documentIds = documents.map((doc) => doc.id)

    await this.deleteByDocumentIds('document_entities', documentIds)
    await this.deleteByDocumentIds('document_graph_edges', documentIds)

    const entityRows: GraphEntityRow[] = []
    const edgeRows: GraphEdgeRow[] = []

    for (const doc of documents) {
      const entities = extractEntities(doc.content, MAX_ENTITY_PER_DOC)
      const page = Number.isFinite(doc.metadata.page) ? doc.metadata.page || null : null

      entities.forEach((entity) => {
        entityRows.push({
          id: stableId(['entity', userId, doc.id, entity.norm]),
          documentId: doc.id,
          userId,
          source: doc.metadata.source,
          page,
          entityValue: entity.value,
          entityNorm: entity.norm,
          entityType: entity.type,
          weight: Number(entity.score.toFixed(6)),
        })
      })

      const edgeEntities = entities.slice(0, MAX_EDGE_ENTITY_PER_DOC)
      for (let i = 0; i < edgeEntities.length; i += 1) {
        for (let j = i + 1; j < edgeEntities.length; j += 1) {
          const left = edgeEntities[i]
          const right = edgeEntities[j]
          const fromEntity = left.norm <= right.norm ? left.norm : right.norm
          const toEntity = left.norm <= right.norm ? right.norm : left.norm
          const weight = Number(((left.score + right.score) / 2).toFixed(6))

          edgeRows.push({
            id: stableId(['edge', userId, doc.id, fromEntity, toEntity]),
            documentId: doc.id,
            userId,
            source: doc.metadata.source,
            page,
            fromEntity,
            toEntity,
            relation: 'co_occurs',
            weight,
          })
        }
      }
    }

    await this.bulkInsertEntities(sql, entityRows)
    await this.bulkInsertEdges(sql, edgeRows)
  }

  async collectSignals(
    query: string,
    userId: string,
    limit: number
  ): Promise<Map<string, GraphSignal>> {
    const queryEntities = this.extractQueryEntities(query)
    if (queryEntities.length === 0) {
      return new Map()
    }

    const signals = new Map<string, GraphSignal>()
    const directRows = await this.queryDirectMatches(userId, queryEntities, limit)

    directRows.forEach((row) => {
      signals.set(row.documentId, {
        directScore: row.score,
        directHits: row.hitCount,
        neighborScore: 0,
        neighborHits: 0,
        matchedEntities: [...row.entityValues].slice(0, 10),
      })
    })

    const neighborEntities = await this.queryNeighborEntities(
      userId,
      queryEntities,
      Math.max(10, Math.ceil(limit / 2))
    )

    if (neighborEntities.length === 0) {
      return signals
    }

    const neighborTerms = neighborEntities.map((item) => item.term)
    const neighborWeights = new Map(
      neighborEntities.map((item) => [item.term, item.score])
    )
    const totalNeighborWeight = Math.max(
      1,
      neighborEntities.reduce((sum, item) => sum + item.score, 0)
    )

    const neighborRows = await this.queryDirectMatches(
      userId,
      neighborTerms,
      Math.max(limit * 2, 20)
    )

    neighborRows.forEach((row) => {
      const weightedTermScore = row.entityNorms.reduce((sum, term) => {
        return sum + (neighborWeights.get(term) || 0)
      }, 0)
      const scale = 0.15 + (weightedTermScore / totalNeighborWeight) * 0.85
      const boostedNeighborScore = row.score * scale

      const existing = signals.get(row.documentId)
      if (existing) {
        existing.neighborScore += boostedNeighborScore
        existing.neighborHits += row.hitCount
        existing.matchedEntities = [
          ...new Set([...existing.matchedEntities, ...row.entityValues]),
        ].slice(0, 12)
        return
      }

      signals.set(row.documentId, {
        directScore: 0,
        directHits: 0,
        neighborScore: boostedNeighborScore,
        neighborHits: row.hitCount,
        matchedEntities: [...row.entityValues].slice(0, 10),
      })
    })

    return signals
  }

  private extractQueryEntities(query: string): string[] {
    const entities = extractEntities(query, MAX_QUERY_ENTITY).map((item) => item.norm)
    if (entities.length >= MAX_QUERY_ENTITY) {
      return entities
    }

    const textTerms = query
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5./%+-]/g, ' ')
      .split(/\s+/)
      .map((term) => normalizeEntityToken(term))
      .filter((term) => shouldKeepEntity(term, 'tech'))

    const merged = [...new Set([...entities, ...textTerms])]
    return merged.slice(0, MAX_QUERY_ENTITY)
  }

  private async deleteByDocumentIds(
    tableName: 'document_entities' | 'document_graph_edges',
    documentIds: string[]
  ) {
    const sql = getSql()
    const idChunks = chunkArray(documentIds, 150)

    for (const idChunk of idChunks) {
      if (idChunk.length === 0) continue
      const placeholders = idChunk
        .map((_, index) => `$${index + 1}`)
        .join(', ')
      await sql(
        `DELETE FROM ${tableName} WHERE document_id IN (${placeholders})`,
        idChunk
      )
    }
  }

  private async bulkInsertEntities(sql: ReturnType<typeof getSql>, rows: GraphEntityRow[]) {
    const rowChunks = chunkArray(rows, BULK_INSERT_BATCH_SIZE)

    for (const rowChunk of rowChunks) {
      if (rowChunk.length === 0) continue

      const valuesSql: string[] = []
      const params: Array<string | number | null> = []

      rowChunk.forEach((row, index) => {
        const offset = index * 9
        valuesSql.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
        )
        params.push(
          row.id,
          row.documentId,
          row.userId,
          row.source,
          row.page,
          row.entityValue,
          row.entityNorm,
          row.entityType,
          row.weight
        )
      })

      await sql(
        `INSERT INTO document_entities (
          id,
          document_id,
          user_id,
          source,
          page,
          entity_value,
          entity_norm,
          entity_type,
          weight
        ) VALUES ${valuesSql.join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          source = EXCLUDED.source,
          page = EXCLUDED.page,
          entity_value = EXCLUDED.entity_value,
          entity_norm = EXCLUDED.entity_norm,
          entity_type = EXCLUDED.entity_type,
          weight = EXCLUDED.weight`,
        params
      )
    }
  }

  private async bulkInsertEdges(sql: ReturnType<typeof getSql>, rows: GraphEdgeRow[]) {
    const rowChunks = chunkArray(rows, BULK_INSERT_BATCH_SIZE)

    for (const rowChunk of rowChunks) {
      if (rowChunk.length === 0) continue

      const valuesSql: string[] = []
      const params: Array<string | number | null> = []

      rowChunk.forEach((row, index) => {
        const offset = index * 9
        valuesSql.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
        )
        params.push(
          row.id,
          row.documentId,
          row.userId,
          row.source,
          row.page,
          row.fromEntity,
          row.toEntity,
          row.relation,
          row.weight
        )
      })

      await sql(
        `INSERT INTO document_graph_edges (
          id,
          document_id,
          user_id,
          source,
          page,
          from_entity,
          to_entity,
          relation,
          weight
        ) VALUES ${valuesSql.join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          source = EXCLUDED.source,
          page = EXCLUDED.page,
          from_entity = EXCLUDED.from_entity,
          to_entity = EXCLUDED.to_entity,
          relation = EXCLUDED.relation,
          weight = EXCLUDED.weight`,
        params
      )
    }
  }

  private async queryDirectMatches(
    userId: string,
    entityNorms: string[],
    limit: number
  ): Promise<
    Array<{
      documentId: string
      score: number
      hitCount: number
      entityNorms: string[]
      entityValues: string[]
    }>
  > {
    if (entityNorms.length === 0) {
      return []
    }

    const uniqueNorms = [...new Set(entityNorms)].slice(0, MAX_QUERY_ENTITY * 2)
    if (uniqueNorms.length === 0) {
      return []
    }

    const sql = getSql()
    const placeholders = uniqueNorms
      .map((_, index) => `$${index + 2}`)
      .join(', ')
    const limitIndex = uniqueNorms.length + 2
    const params: Array<string | number> = [
      userId,
      ...uniqueNorms,
      Math.max(1, limit),
    ]

    const rows = await sql(
      `SELECT
        document_id,
        SUM(weight)::float AS signal_score,
        COUNT(DISTINCT entity_norm)::int AS hit_count,
        ARRAY_AGG(DISTINCT entity_norm) AS matched_norms,
        ARRAY_AGG(DISTINCT entity_value) AS matched_entities
      FROM document_entities
      WHERE user_id = $1 AND entity_norm IN (${placeholders})
      GROUP BY document_id
      ORDER BY signal_score DESC, hit_count DESC
      LIMIT $${limitIndex}`,
      params
    ) as DirectSignalRow[]

    return rows.map((row) => ({
      documentId: row.document_id,
      score: toFiniteNumber(row.signal_score),
      hitCount: Math.max(0, Math.floor(toFiniteNumber(row.hit_count))),
      entityNorms: parseTextArray(row.matched_norms),
      entityValues: parseTextArray(row.matched_entities),
    }))
  }

  private async queryNeighborEntities(
    userId: string,
    seedEntities: string[],
    limit: number
  ): Promise<Array<{ term: string; score: number }>> {
    if (seedEntities.length === 0) {
      return []
    }

    const seeds = [...new Set(seedEntities)].slice(0, MAX_QUERY_ENTITY)
    const sql = getSql()

    const fromPlaceholders = seeds
      .map((_, index) => `$${index + 2}`)
      .join(', ')
    const toStart = seeds.length + 2
    const toPlaceholders = seeds
      .map((_, index) => `$${toStart + index}`)
      .join(', ')
    const limitIndex = seeds.length * 2 + 2

    const params: Array<string | number> = [
      userId,
      ...seeds,
      ...seeds,
      Math.max(1, limit),
    ]

    const rows = await sql(
      `SELECT
        CASE
          WHEN from_entity IN (${fromPlaceholders}) THEN to_entity
          ELSE from_entity
        END AS neighbor_entity,
        SUM(weight)::float AS edge_score
      FROM document_graph_edges
      WHERE user_id = $1
        AND (
          from_entity IN (${fromPlaceholders})
          OR to_entity IN (${toPlaceholders})
        )
      GROUP BY neighbor_entity
      ORDER BY edge_score DESC
      LIMIT $${limitIndex}`,
      params
    ) as NeighborEntityRow[]

    return rows
      .map((row) => ({
        term: row.neighbor_entity,
        score: toFiniteNumber(row.edge_score),
      }))
      .filter((item) => item.term && item.score > 0)
  }
}

