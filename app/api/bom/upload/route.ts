import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { parseExcelBuffer, parsePdfBuffer } from '@/lib/bom-file-parser'
import { parseBomText } from '@/lib/bom-parser'
import { createProject, addItems } from '@/lib/bom-db'

export const runtime = 'nodejs'
export const maxDuration = 60

// 支持的文件类型
const ALLOWED_TYPES: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
  'application/pdf': 'pdf',
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * POST /api/bom/upload
 * 上传 BOM 文件（Excel/CSV/PDF）并解析
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const projectName = formData.get('projectName') as string | null

    if (!file) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 })
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 })
    }

    // 检查文件类型
    const ext = file.name.split('.').pop()?.toLowerCase()
    const isAllowedMime = ALLOWED_TYPES[file.type]
    const isAllowedExt = ext && ['xlsx', 'xls', 'csv', 'pdf'].includes(ext)

    if (!isAllowedMime && !isAllowedExt) {
      return NextResponse.json(
        { error: '不支持的文件格式，请上传 Excel (.xlsx/.xls)、CSV 或 PDF 文件' },
        { status: 400 }
      )
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 根据文件类型解析
    let extractedText: string
    const fileType = ext || isAllowedMime

    if (fileType === 'pdf') {
      extractedText = await parsePdfBuffer(buffer)
    } else {
      // xlsx, xls, csv 都走 Excel 解析
      extractedText = parseExcelBuffer(buffer, file.name)
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: '未能从文件中提取到内容，请检查文件是否包含元器件信息' },
        { status: 400 }
      )
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

      return {
        apiKey: user.bom_api_key || (aiLooksDeepSeek ? user.anthropic_api_key : undefined),
        baseUrl: user.bom_base_url || (aiLooksDeepSeek ? user.anthropic_base_url : undefined),
        model: /deepseek/i.test(aiModel) ? aiModel : undefined,
      }
    })() : undefined

    // AI 解析提取的文本
    const parseResult = await parseBomText(extractedText, bomConfig)

    if (parseResult.items.length === 0) {
      return NextResponse.json({
        error: '未能解析出元器件信息',
        extractedText: extractedText.substring(0, 500),
        warnings: parseResult.warnings,
      }, { status: 400 })
    }

    // 创建项目
    const name = projectName || `${file.name} - ${new Date().toLocaleDateString('zh-CN')}`
    const project = await createProject(authResult.user.id, name, extractedText)

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
      extractedText: extractedText.substring(0, 500),
      warnings: parseResult.warnings,
      parseEngine: parseResult.parseEngine,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: fileType,
      },
    })
  } catch (error) {
    console.error('BOM 文件上传解析错误:', error)
    return NextResponse.json(
      { error: '文件解析失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
