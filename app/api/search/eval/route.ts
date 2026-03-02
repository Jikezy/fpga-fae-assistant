import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import {
  getVectorStore,
  SearchScoredDocument,
} from '@/lib/simpleVectorStore'

export const runtime = 'nodejs'
export const maxDuration = 120

interface EvalSampleInput {
  id?: unknown
  query?: unknown
  expectedSource?: unknown
  expectedPage?: unknown
  expectedKeywords?: unknown
}

interface NormalizedEvalSample {
  id: string
  query: string
  expectedSource?: string
  expectedPage?: number
  expectedKeywords: string[]
}

interface ModeSampleMetrics {
  latencyMs: number
  returnedCount: number
  rank: number | null
  reciprocalRank: number
  hitAt1: boolean
  hitAt3: boolean
  hitAt5: boolean
  hitAtK: boolean
  sourceRank: number | null
  pageRank: number | null
  keywordRank: number | null
  topSource: string | null
  topPage: number | null
  topScore: number | null
}

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

function normalizeSourceName(source: string): string {
  return source
    .split(/[/\\]/)
    .pop()
    ?.trim()
    .toLowerCase() || source.trim().toLowerCase()
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10)
}

function hasExpectation(sample: NormalizedEvalSample): boolean {
  return Boolean(
    sample.expectedSource ||
      Number.isFinite(sample.expectedPage) ||
      sample.expectedKeywords.length > 0
  )
}

function doesSourceMatch(doc: SearchScoredDocument, expectedSource: string): boolean {
  const actual = normalizeSourceName(doc.metadata.source)
  const expected = normalizeSourceName(expectedSource)
  return (
    actual === expected ||
    actual.includes(expected) ||
    expected.includes(actual)
  )
}

function doesPageMatch(doc: SearchScoredDocument, expectedPage: number): boolean {
  return doc.metadata.page === expectedPage
}

function doesKeywordMatch(
  doc: SearchScoredDocument,
  expectedKeywords: string[]
): boolean {
  if (expectedKeywords.length === 0) return true
  const merged = `${doc.content}\n${doc.matchedEntities.join(' ')}`.toLowerCase()
  return expectedKeywords.some((keyword) => merged.includes(keyword))
}

function findRank(
  docs: SearchScoredDocument[],
  matcher: (doc: SearchScoredDocument) => boolean
): number | null {
  for (let i = 0; i < docs.length; i += 1) {
    if (matcher(docs[i])) {
      return i + 1
    }
  }
  return null
}

function evaluateModeSample(
  docs: SearchScoredDocument[],
  sample: NormalizedEvalSample,
  topK: number,
  latencyMs: number
): ModeSampleMetrics {
  const expected = hasExpectation(sample)
  const sourceRank = sample.expectedSource
    ? findRank(docs, (doc) => doesSourceMatch(doc, sample.expectedSource!))
    : null

  const pageRank =
    Number.isFinite(sample.expectedPage) && typeof sample.expectedPage === 'number'
      ? findRank(docs, (doc) => {
          const sourceOk = sample.expectedSource
            ? doesSourceMatch(doc, sample.expectedSource)
            : true
          return sourceOk && doesPageMatch(doc, sample.expectedPage!)
        })
      : null

  const keywordRank =
    sample.expectedKeywords.length > 0
      ? findRank(docs, (doc) =>
          doesKeywordMatch(doc, sample.expectedKeywords)
        )
      : null

  const rank = expected
    ? findRank(docs, (doc) => {
        const sourceOk = sample.expectedSource
          ? doesSourceMatch(doc, sample.expectedSource)
          : true
        const pageOk =
          Number.isFinite(sample.expectedPage) &&
          typeof sample.expectedPage === 'number'
            ? doesPageMatch(doc, sample.expectedPage)
            : true
        const keywordOk = doesKeywordMatch(doc, sample.expectedKeywords)
        return sourceOk && pageOk && keywordOk
      })
    : null

  return {
    latencyMs,
    returnedCount: docs.length,
    rank,
    reciprocalRank: rank ? 1 / rank : 0,
    hitAt1: rank === 1,
    hitAt3: rank !== null && rank <= 3,
    hitAt5: rank !== null && rank <= 5,
    hitAtK: rank !== null && rank <= topK,
    sourceRank,
    pageRank,
    keywordRank,
    topSource: docs[0]?.metadata.source || null,
    topPage: docs[0]?.metadata.page ?? null,
    topScore: docs[0] ? Number(docs[0].score.toFixed(6)) : null,
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const clamped = Math.min(1, Math.max(0, p))
  const index = Math.floor(clamped * (sorted.length - 1))
  return sorted[index]
}

function toRate(hitCount: number, totalCount: number): number | null {
  if (totalCount <= 0) return null
  return Number((hitCount / totalCount).toFixed(6))
}

function summarizeMode(
  samples: Array<{
    sample: NormalizedEvalSample
    metrics: ModeSampleMetrics
  }>,
  topK: number
) {
  const allMetrics = samples.map((item) => item.metrics)
  const labeled = samples.filter((item) => hasExpectation(item.sample))
  const labeledMetrics = labeled.map((item) => item.metrics)

  const withSource = samples.filter((item) => !!item.sample.expectedSource)
  const withPage = samples.filter(
    (item) =>
      Number.isFinite(item.sample.expectedPage) &&
      typeof item.sample.expectedPage === 'number'
  )
  const withKeywords = samples.filter(
    (item) => item.sample.expectedKeywords.length > 0
  )

  const latencyValues = allMetrics.map((item) => item.latencyMs)
  const returnedValues = allMetrics.map((item) => item.returnedCount)
  const mrr =
    labeledMetrics.length > 0
      ? Number(
          (
            labeledMetrics.reduce((sum, item) => sum + item.reciprocalRank, 0) /
            labeledMetrics.length
          ).toFixed(6)
        )
      : null

  return {
    sampleCount: samples.length,
    labeledCount: labeledMetrics.length,
    avgLatencyMs: Number(
      (
        latencyValues.reduce((sum, value) => sum + value, 0) /
        Math.max(1, latencyValues.length)
      ).toFixed(2)
    ),
    p95LatencyMs: Number(percentile(latencyValues, 0.95).toFixed(2)),
    avgReturnedCount: Number(
      (
        returnedValues.reduce((sum, value) => sum + value, 0) /
        Math.max(1, returnedValues.length)
      ).toFixed(2)
    ),
    hitAt1Rate: toRate(
      labeledMetrics.filter((item) => item.hitAt1).length,
      labeledMetrics.length
    ),
    hitAt3Rate: toRate(
      labeledMetrics.filter((item) => item.hitAt3).length,
      labeledMetrics.length
    ),
    hitAt5Rate: toRate(
      labeledMetrics.filter((item) => item.hitAt5).length,
      labeledMetrics.length
    ),
    hitAtKRate: toRate(
      labeledMetrics.filter((item) => item.hitAtK).length,
      labeledMetrics.length
    ),
    mrr,
    sourceHitRate: toRate(
      withSource.filter(
        (item) =>
          item.metrics.sourceRank !== null && item.metrics.sourceRank <= topK
      ).length,
      withSource.length
    ),
    pageHitRate: toRate(
      withPage.filter(
        (item) => item.metrics.pageRank !== null && item.metrics.pageRank <= topK
      ).length,
      withPage.length
    ),
    keywordHitRate: toRate(
      withKeywords.filter(
        (item) =>
          item.metrics.keywordRank !== null && item.metrics.keywordRank <= topK
      ).length,
      withKeywords.length
    ),
  }
}

function normalizeSamples(rawSamples: EvalSampleInput[]): {
  samples: NormalizedEvalSample[]
  error?: string
} {
  const normalized: NormalizedEvalSample[] = []

  for (let i = 0; i < rawSamples.length; i += 1) {
    const item = rawSamples[i]
    const query =
      typeof item.query === 'string' ? item.query.trim() : ''

    if (!query) {
      return {
        samples: [],
        error: `第 ${i + 1} 条样本缺少有效 query`,
      }
    }

    const expectedSource =
      typeof item.expectedSource === 'string' && item.expectedSource.trim()
        ? item.expectedSource.trim()
        : undefined
    const expectedPageRaw = toFiniteNumber(item.expectedPage)
    const expectedPage =
      expectedPageRaw > 0 ? Math.floor(expectedPageRaw) : undefined

    normalized.push({
      id:
        typeof item.id === 'string' && item.id.trim()
          ? item.id.trim()
          : `sample-${i + 1}`,
      query,
      expectedSource,
      expectedPage,
      expectedKeywords: normalizeKeywords(item.expectedKeywords),
    })
  }

  return { samples: normalized }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const body = (await req.json().catch(() => null)) as
      | {
          samples?: EvalSampleInput[]
          topK?: number
        }
      | null

    const rawSamples = Array.isArray(body?.samples) ? body?.samples : []
    if (rawSamples.length === 0) {
      return NextResponse.json(
        { error: '请提供 samples（至少 1 条评测样本）' },
        { status: 400 }
      )
    }
    if (rawSamples.length > 200) {
      return NextResponse.json(
        { error: 'samples 过多，单次最多 200 条' },
        { status: 400 }
      )
    }

    const topK = Math.min(
      20,
      Math.max(1, Number.isFinite(body?.topK) ? Math.floor(body!.topK!) : 8)
    )

    const { samples, error } = normalizeSamples(rawSamples)
    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    const vectorStore = getVectorStore()
    await vectorStore.initialize()

    const corpusSummary = await vectorStore.listDocuments(authResult.user.id)
    const totalChunks = corpusSummary.reduce((sum, item) => sum + item.chunks, 0)

    const evaluatedSamples: Array<{
      sample: NormalizedEvalSample
      graph: ModeSampleMetrics
      lexical: ModeSampleMetrics
    }> = []

    for (const sample of samples) {
      const graphStart = Date.now()
      const graphResults = await vectorStore.searchWithGraph(
        sample.query,
        topK,
        authResult.user.id
      )
      const graphLatency = Date.now() - graphStart

      const lexicalStart = Date.now()
      const lexicalResults = await vectorStore.searchLexicalBaseline(
        sample.query,
        topK,
        authResult.user.id
      )
      const lexicalLatency = Date.now() - lexicalStart

      evaluatedSamples.push({
        sample,
        graph: evaluateModeSample(graphResults, sample, topK, graphLatency),
        lexical: evaluateModeSample(
          lexicalResults,
          sample,
          topK,
          lexicalLatency
        ),
      })
    }

    const graphSummary = summarizeMode(
      evaluatedSamples.map((item) => ({
        sample: item.sample,
        metrics: item.graph,
      })),
      topK
    )
    const lexicalSummary = summarizeMode(
      evaluatedSamples.map((item) => ({
        sample: item.sample,
        metrics: item.lexical,
      })),
      topK
    )

    const delta = {
      hitAtKRateDelta:
        graphSummary.hitAtKRate !== null && lexicalSummary.hitAtKRate !== null
          ? Number((graphSummary.hitAtKRate - lexicalSummary.hitAtKRate).toFixed(6))
          : null,
      mrrDelta:
        graphSummary.mrr !== null && lexicalSummary.mrr !== null
          ? Number((graphSummary.mrr - lexicalSummary.mrr).toFixed(6))
          : null,
      avgLatencyMsDelta: Number(
        (graphSummary.avgLatencyMs - lexicalSummary.avgLatencyMs).toFixed(2)
      ),
      p95LatencyMsDelta: Number(
        (graphSummary.p95LatencyMs - lexicalSummary.p95LatencyMs).toFixed(2)
      ),
    }

    return NextResponse.json({
      success: true,
      config: {
        topK,
        sampleCount: samples.length,
      },
      corpus: {
        documentCount: corpusSummary.length,
        chunkCount: totalChunks,
      },
      summary: {
        graph: graphSummary,
        lexical: lexicalSummary,
        delta,
      },
      samples: evaluatedSamples.map((item) => {
        const graphRank = item.graph.rank
        const lexicalRank = item.lexical.rank
        return {
          id: item.sample.id,
          query: item.sample.query,
          expected: {
            source: item.sample.expectedSource || null,
            page: item.sample.expectedPage || null,
            keywords: item.sample.expectedKeywords,
          },
          graph: item.graph,
          lexical: item.lexical,
          delta: {
            rankGain:
              graphRank !== null && lexicalRank !== null
                ? lexicalRank - graphRank
                : null,
            hitAtKGain:
              Number(item.graph.hitAtK) - Number(item.lexical.hitAtK),
            latencyMsDelta: item.graph.latencyMs - item.lexical.latencyMs,
          },
        }
      }),
    })
  } catch (error) {
    console.error('search eval failed:', error)
    return NextResponse.json(
      { error: '检索评测失败' },
      { status: 500 }
    )
  }
}

