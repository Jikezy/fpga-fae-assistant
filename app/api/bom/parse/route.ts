import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { parseBomText } from '@/lib/bom-parser'
import { createProject, addItems } from '@/lib/bom-db'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/bom/parse
 * 解析 BOM 文本并创建项目
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const { text, projectName } = await req.json()

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: '请输入 BOM 清单内容' }, { status: 400 })
    }

    // 读取用户的 BOM 解析配置
    const { getSql, ensureAiModelColumn } = await import('@/lib/db-schema')
    await ensureAiModelColumn()
    const sql = getSql()
    const userRows = await sql`SELECT bom_api_key, bom_base_url, bom_model, ai_model, anthropic_api_key, anthropic_base_url FROM users WHERE id = ${authResult.user.id}`
    const bomConfig = userRows.length > 0 ? (() => {
      const user = userRows[0] as any
      const trimValue = (value: unknown) => typeof value === 'string' ? value.trim() : ''

      const bomApiKey = trimValue(user.bom_api_key)
      const bomBaseUrl = trimValue(user.bom_base_url)
      const bomModel = trimValue(user.bom_model)

      const aiApiKey = trimValue(user.anthropic_api_key)
      const aiBaseUrl = trimValue(user.anthropic_base_url)
      const aiModel = trimValue(user.ai_model)
      const aiLooksDeepSeek = /deepseek/i.test(aiModel) || /deepseek/i.test(aiBaseUrl)

      // BOM parsing always prefers BOM-specific credentials.
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
    })() : undefined

    // AI 解析 BOM
    const parseResult = await parseBomText(text.trim(), bomConfig)

    if (parseResult.items.length === 0) {
      return NextResponse.json({
        error: '未能解析出任何元器件',
        warnings: parseResult.warnings,
      }, { status: 400 })
    }

    // 创建项目
    const name = projectName || `采购清单 ${new Date().toLocaleDateString('zh-CN')}`
    const project = await createProject(authResult.user.id, name, text.trim())

    // 添加解析出的元器件
    const items = await addItems(project.id, parseResult.items.map(item => ({
      rawInput: item.name + (item.spec ? ` ${item.spec}` : ''),
      parsedName: item.name,
      parsedSpec: item.spec,
      searchKeyword: item.searchKeyword,
      quantity: item.quantity,
    })))

    return NextResponse.json({
      project,
      items,
      warnings: parseResult.warnings,
      parseEngine: parseResult.parseEngine,
    })
  } catch (error) {
    console.error('BOM 解析错误:', error)
    return NextResponse.json(
      { error: '解析失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
