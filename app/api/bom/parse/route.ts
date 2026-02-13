import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { parseBomText } from '@/lib/bom-parser'
import { createProject, addItems } from '@/lib/bom-db'
import { acquireBomParseSlot, checkBomParseRateLimit } from '@/lib/bom-request-guard'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const { text, projectName } = await req.json()

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: '\u8bf7\u8f93\u5165 BOM \u6e05\u5355\u5185\u5bb9' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimitResult = checkBomParseRateLimit(authResult.user.id, ip)
    if (rateLimitResult.limited) {
      return NextResponse.json(
        {
          error: rateLimitResult.message,
          code: 'BOM_RATE_LIMIT',
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
        { status: 429 }
      )
    }

    const slot = await acquireBomParseSlot()
    if (!slot) {
      return NextResponse.json(
        {
          error: '\u5f53\u524d\u89e3\u6790\u4efb\u52a1\u8f83\u591a\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5',
          code: 'BOM_BUSY',
        },
        { status: 503 }
      )
    }

    try {
      const { getSql, ensureAiModelColumn } = await import('@/lib/db-schema')
      await ensureAiModelColumn()
      const sql = getSql()
      const userRows = await sql`
        SELECT bom_api_key, bom_base_url, bom_model, ai_model, anthropic_api_key, anthropic_base_url
        FROM users
        WHERE id = ${authResult.user.id}
      `

      const bomConfig = userRows.length > 0
        ? (() => {
            const user = userRows[0] as any
            const trimValue = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

            const bomApiKey = trimValue(user.bom_api_key)
            const bomBaseUrl = trimValue(user.bom_base_url)
            const bomModel = trimValue(user.bom_model)

            const aiApiKey = trimValue(user.anthropic_api_key)
            const aiBaseUrl = trimValue(user.anthropic_base_url)
            const aiModel = trimValue(user.ai_model)
            const aiLooksDeepSeek = /deepseek/i.test(aiModel) || /deepseek/i.test(aiBaseUrl)

            const primaryApiKey = bomApiKey || (aiLooksDeepSeek ? aiApiKey : '')
            const primaryBaseUrl = bomBaseUrl || (!bomApiKey && aiLooksDeepSeek ? aiBaseUrl : '')

            const backupApiKey = bomApiKey && aiLooksDeepSeek && aiApiKey !== bomApiKey
              ? aiApiKey
              : undefined
            const backupBaseUrl = backupApiKey ? aiBaseUrl : undefined

            const model = bomModel || (aiLooksDeepSeek && aiModel ? aiModel : 'deepseek-chat')

            return {
              apiKey: primaryApiKey || undefined,
              baseUrl: primaryBaseUrl || undefined,
              backupApiKey,
              backupBaseUrl,
              model,
            }
          })()
        : undefined

      const parseResult = await parseBomText(text.trim(), bomConfig)

      if (parseResult.items.length === 0) {
        return NextResponse.json(
          {
            error: '\u672a\u80fd\u89e3\u6790\u51fa\u4efb\u4f55\u5143\u5668\u4ef6',
            warnings: parseResult.warnings,
          },
          { status: 400 }
        )
      }

      const name = projectName || `\u91c7\u8d2d\u6e05\u5355 ${new Date().toLocaleDateString('zh-CN')}`
      const project = await createProject(authResult.user.id, name, text.trim())

      const items = await addItems(
        project.id,
        parseResult.items.map((item) => ({
          rawInput: item.name + (item.spec ? ` ${item.spec}` : ''),
          parsedName: item.name,
          parsedSpec: item.spec,
          searchKeyword: item.searchKeyword,
          quantity: item.quantity,
        }))
      )

      return NextResponse.json({
        project,
        items,
        warnings: parseResult.warnings,
        parseEngine: parseResult.parseEngine,
        queueWaitMs: slot.waitMs,
      })
    } finally {
      slot.release()
    }
  } catch (error) {
    console.error('BOM parse failed:', error)
    return NextResponse.json(
      {
        error: '\u89e3\u6790\u5931\u8d25',
        message: error instanceof Error ? error.message : '\u672a\u77e5\u9519\u8bef',
      },
      { status: 500 }
    )
  }
}
