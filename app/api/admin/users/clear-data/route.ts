import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { getSql } from '@/lib/db-schema'

export const runtime = 'nodejs'

type DeletedTableStat = {
  tableName: string
  deletedRows: number
}

const TABLE_PRIORITY = ['sessions', 'embeddings', 'documents', 'bom_projects']

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function isSafeIdentifier(name: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(name)
}

function sortUserTables(tables: string[]): string[] {
  const rank = new Map(TABLE_PRIORITY.map((name, index) => [name, index]))

  return [...tables].sort((a, b) => {
    const rankA = rank.has(a) ? rank.get(a)! : Number.MAX_SAFE_INTEGER
    const rankB = rank.has(b) ? rank.get(b)! : Number.MAX_SAFE_INTEGER

    if (rankA !== rankB) return rankA - rankB
    return a.localeCompare(b)
  })
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const body = await req.json().catch(() => ({}))
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''

    if (!userId) {
      return NextResponse.json({ error: '\u7f3a\u5c11\u7528\u6237ID' }, { status: 400 })
    }

    const sql = getSql()

    const userRows = await sql`
      SELECT id, email
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `

    if (userRows.length === 0) {
      return NextResponse.json({ error: '\u7528\u6237\u4e0d\u5b58\u5728' }, { status: 404 })
    }

    const tableRows = await sql`
      SELECT DISTINCT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'user_id'
    `

    const tables = sortUserTables(
      tableRows
        .map((row) => (typeof row.table_name === 'string' ? row.table_name : ''))
        .filter((tableName) => tableName && tableName !== 'users' && isSafeIdentifier(tableName))
    )

    const deletedTables: DeletedTableStat[] = []

    for (const tableName of tables) {
      const result = await sql(
        `WITH deleted_rows AS (
           DELETE FROM "${tableName}"
           WHERE user_id = $1
           RETURNING 1
         )
         SELECT COUNT(*)::bigint AS deleted_count
         FROM deleted_rows`,
        [userId]
      )

      deletedTables.push({
        tableName,
        deletedRows: toNumber(result[0]?.deleted_count),
      })
    }

    const getCount = (tableName: string) =>
      deletedTables.find((item) => item.tableName === tableName)?.deletedRows ?? 0

    const totalDeletedRows = deletedTables.reduce((sum, item) => sum + item.deletedRows, 0)

    return NextResponse.json({
      success: true,
      message: '\u7528\u6237\u6570\u636e\u5df2\u6e05\u7a7a',
      user: {
        id: userRows[0].id,
        email: userRows[0].email,
      },
      summary: {
        sessions: getCount('sessions'),
        documents: getCount('documents'),
        embeddings: getCount('embeddings'),
        bomProjects: getCount('bom_projects'),
      },
      deletedTables,
      totalDeletedRows,
      note: '\u804a\u5929\u6d88\u606f\u9ed8\u8ba4\u4e0d\u5728\u670d\u52a1\u7aef\u6301\u4e45\u5316\uff0c\u5df2\u6e05\u7a7a\u8be5\u7528\u6237\u53ef\u8bc6\u522b\u7684\u4e1a\u52a1\u6570\u636e\u3002',
    })
  } catch (error) {
    console.error('clear user data failed:', error)
    return NextResponse.json({ error: '\u6e05\u7a7a\u7528\u6237\u6570\u636e\u5931\u8d25' }, { status: 500 })
  }
}
