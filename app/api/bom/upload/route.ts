import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { parseExcelBuffer, parsePdfBuffer } from '@/lib/bom-file-parser'
import { parseBomText } from '@/lib/bom-parser'
import { createProject, addItems } from '@/lib/bom-db'
import { acquireBomParseSlot, checkBomParseRateLimit } from '@/lib/bom-request-guard'

export const runtime = 'nodejs'
export const maxDuration = 120

const ALLOWED_TYPES: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
  'application/pdf': 'pdf',
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const projectName = formData.get('projectName') as string | null

    if (!file) {
      return NextResponse.json({ error: '\u8bf7\u9009\u62e9\u8981\u4e0a\u4f20\u7684\u6587\u4ef6' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '\u6587\u4ef6\u5927\u5c0f\u4e0d\u80fd\u8d85\u8fc7 10MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    const isAllowedMime = ALLOWED_TYPES[file.type]
    const isAllowedExt = ext && ['xlsx', 'xls', 'csv', 'pdf'].includes(ext)

    if (!isAllowedMime && !isAllowedExt) {
      return NextResponse.json(
        { error: '\u4e0d\u652f\u6301\u7684\u6587\u4ef6\u683c\u5f0f\uff0c\u8bf7\u4e0a\u4f20 Excel (.xlsx/.xls)\u3001CSV \u6216 PDF \u6587\u4ef6' },
        { status: 400 }
      )
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
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      let extractedText: string
      const fileType = ext || isAllowedMime

      if (fileType === 'pdf') {
        extractedText = await parsePdfBuffer(buffer)
      } else {
        extractedText = parseExcelBuffer(buffer, file.name)
      }

      if (!extractedText || extractedText.trim().length === 0) {
        return NextResponse.json(
          { error: '\u672a\u80fd\u4ece\u6587\u4ef6\u4e2d\u63d0\u53d6\u5230\u5185\u5bb9\uff0c\u8bf7\u68c0\u67e5\u6587\u4ef6\u662f\u5426\u5305\u542b\u5143\u5668\u4ef6\u4fe1\u606f' },
          { status: 400 }
        )
      }

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

      const parseResult = await parseBomText(extractedText, bomConfig)

      if (parseResult.items.length === 0) {
        return NextResponse.json(
          {
            error: '\u672a\u80fd\u89e3\u6790\u51fa\u5143\u5668\u4ef6\u4fe1\u606f',
            extractedText: extractedText.substring(0, 500),
            warnings: parseResult.warnings,
          },
          { status: 400 }
        )
      }

      const name = projectName || `${file.name} - ${new Date().toLocaleDateString('zh-CN')}`
      const project = await createProject(authResult.user.id, name, extractedText)

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
        extractedText: extractedText.substring(0, 500),
        warnings: parseResult.warnings,
        parseEngine: parseResult.parseEngine,
        queueWaitMs: slot.waitMs,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: fileType,
        },
      })
    } finally {
      slot.release()
    }
  } catch (error) {
    console.error('BOM upload parse failed:', error)
    return NextResponse.json(
      {
        error: '\u6587\u4ef6\u89e3\u6790\u5931\u8d25',
        message: error instanceof Error ? error.message : '\u672a\u77e5\u9519\u8bef',
      },
      { status: 500 }
    )
  }
}
