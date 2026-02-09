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

    // AI 解析 BOM（走 DeepSeek，不需要用户 API key）
    const parseResult = await parseBomText(text.trim())

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
    })
  } catch (error) {
    console.error('BOM 解析错误:', error)
    return NextResponse.json(
      { error: '解析失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
