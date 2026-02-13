import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { parseBomText } from '@/lib/bom-parser'
import { createProject, addItems } from '@/lib/bom-db'

export const runtime = 'nodejs'
export const maxDuration = 60

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
    const userRows = await sql`SELECT bom_api_key, bom_base_url, ai_model, anthropic_api_key, anthropic_base_url FROM users WHERE id = ${authResult.user.id}`
    const bomConfig = userRows.length > 0 ? (() => {
      const user = userRows[0] as any
      const aiModel = user.ai_model || ''
      const aiBaseUrl = user.anthropic_base_url || ''
      const aiLooksDeepSeek = /deepseek/i.test(aiModel) || /deepseek/i.test(aiBaseUrl)
      const preferAiConfig = aiLooksDeepSeek && !!user.anthropic_api_key

      const primaryApiKey = preferAiConfig
        ? user.anthropic_api_key
        : user.bom_api_key || (aiLooksDeepSeek ? user.anthropic_api_key : undefined)

      const primaryBaseUrl = preferAiConfig
        ? user.anthropic_base_url || user.bom_base_url
        : user.bom_base_url || (aiLooksDeepSeek ? user.anthropic_base_url : undefined)

      const backupApiKey = preferAiConfig
        ? (user.bom_api_key && user.bom_api_key !== user.anthropic_api_key ? user.bom_api_key : undefined)
        : (aiLooksDeepSeek && user.bom_api_key ? user.anthropic_api_key : undefined)

      const backupBaseUrl = preferAiConfig
        ? (user.bom_base_url || undefined)
        : (aiLooksDeepSeek && user.bom_api_key ? user.anthropic_base_url : undefined)

      return {
        apiKey: primaryApiKey,
        baseUrl: primaryBaseUrl,
        backupApiKey,
        backupBaseUrl,
        model: /deepseek/i.test(aiModel) ? aiModel : undefined,
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
