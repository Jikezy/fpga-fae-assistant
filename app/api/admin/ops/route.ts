import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { getSql } from '@/lib/db-schema'

export const runtime = 'nodejs'

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function pressureLevel(ratioPercent: number): 'low' | 'medium' | 'high' | 'critical' {
  if (ratioPercent >= 95) return 'critical'
  if (ratioPercent >= 75) return 'high'
  if (ratioPercent >= 50) return 'medium'
  return 'low'
}

/**
 * Admin-only operations dashboard metrics.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req)
  if (authResult.error) return authResult.error

  try {
    const sql = getSql()

    const summaryRows = await sql`
      SELECT
        CASE WHEN to_regclass('public.users') IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM users)::bigint END AS users,
        CASE WHEN to_regclass('public.sessions') IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM sessions)::bigint END AS sessions,
        CASE WHEN to_regclass('public.documents') IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM documents)::bigint END AS documents,
        CASE WHEN to_regclass('public.bom_projects') IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM bom_projects)::bigint END AS bom_projects,
        CASE WHEN to_regclass('public.bom_items') IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM bom_items)::bigint END AS bom_items,
        CASE WHEN to_regclass('public.price_cache') IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM price_cache WHERE expires_at > NOW())::bigint END AS active_price_cache,
        CASE WHEN to_regclass('public.bom_projects') IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM bom_projects WHERE created_at >= NOW() - INTERVAL '24 hours')::bigint END AS bom_projects_24h,
        CASE WHEN to_regclass('public.bom_items') IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM bom_items WHERE created_at >= NOW() - INTERVAL '24 hours')::bigint END AS bom_items_24h
    `

    const dbRows = await sql`
      SELECT
        current_database() AS database_name,
        pg_database_size(current_database())::bigint AS bytes,
        pg_size_pretty(pg_database_size(current_database())) AS pretty
    `

    const tableRows = await sql`
      SELECT
        c.relname AS table_name,
        pg_total_relation_size(c.oid)::bigint AS bytes,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS pretty,
        COALESCE(s.n_live_tup, 0)::bigint AS row_estimate
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE c.relkind = 'r'
        AND n.nspname = 'public'
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 12
    `

    const summary = summaryRows[0] ?? {}
    const db = dbRows[0] ?? {}

    const storageHalfGbBytes = 0.5 * 1024 * 1024 * 1024
    const usedBytes = toNumber(db.bytes)
    const usagePercent = Number(((usedBytes / storageHalfGbBytes) * 100).toFixed(2))

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      summary: {
        users: toNumber(summary.users),
        sessions: toNumber(summary.sessions),
        documents: toNumber(summary.documents),
        bomProjects: toNumber(summary.bom_projects),
        bomItems: toNumber(summary.bom_items),
        activePriceCache: toNumber(summary.active_price_cache),
        bomProjects24h: toNumber(summary.bom_projects_24h),
        bomItems24h: toNumber(summary.bom_items_24h),
      },
      database: {
        name: typeof db.database_name === 'string' ? db.database_name : 'unknown',
        bytes: usedBytes,
        pretty: typeof db.pretty === 'string' ? db.pretty : '0 bytes',
      },
      pressure: {
        usagePercentOfHalfGb: usagePercent,
        level: pressureLevel(usagePercent),
      },
      tables: tableRows.map(row => ({
        tableName: typeof row.table_name === 'string' ? row.table_name : 'unknown',
        bytes: toNumber(row.bytes),
        pretty: typeof row.pretty === 'string' ? row.pretty : '0 bytes',
        rowEstimate: toNumber(row.row_estimate),
      })),
    })
  } catch (error) {
    console.error('Failed to load ops metrics:', error)
    return NextResponse.json({ error: 'Failed to load ops metrics' }, { status: 500 })
  }
}
