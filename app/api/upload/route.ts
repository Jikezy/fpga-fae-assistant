import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// 使用 Node.js runtime 而不是 Edge runtime，因为需要处理PDF
export const runtime = 'nodejs'
// 增加超时时间到120秒（多模态增强解析需要更长时间）
export const maxDuration = 120

const MULTIMODAL_MAX_FILE_SIZE_MB = 8

type UserAiConfigRow = {
  anthropic_api_key: string | null
  anthropic_base_url: string | null
  ai_model: string | null
}

export async function GET(req: NextRequest) {
  // 验证用户登录
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    // 动态导入以避免模块加载时的初始化问题
    const { getVectorStore } = await import('@/lib/simpleVectorStore')

    const vectorStore = getVectorStore()
    await vectorStore.initialize()
    // 只获取当前用户的文档
    const documentsInfo = await vectorStore.listDocuments(authResult.user.id)

    // listDocuments() 返回的已经是按source分组的唯一文档列表
    const uniqueFiles = documentsInfo.map(info => info.source)
    const totalChunks = documentsInfo.reduce((sum, info) => sum + info.chunks, 0)

    return NextResponse.json({
      success: true,
      documents: uniqueFiles,
      total: totalChunks,
    })
  } catch (error) {
    console.error('GET /api/upload error:', error)
    return NextResponse.json({
      success: true,
      documents: [],
      total: 0,
    })
  }
}

export async function POST(req: NextRequest) {
  // 验证用户登录
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '未找到上传文件' },
        { status: 400 }
      )
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: '仅支持PDF文件' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const maxSizeMB = 10
    const fileSizeMB = buffer.length / 1024 / 1024
    if (fileSizeMB > maxSizeMB) {
      return NextResponse.json(
        { error: `文件大小超过限制（最大${maxSizeMB}MB）` },
        { status: 400 }
      )
    }

    // 动态导入以避免模块加载时的初始化问题
    const { processPDF } = await import('@/lib/pdfProcessor')
    const { getVectorStore } = await import('@/lib/simpleVectorStore')
    const { getSql, ensureAiModelColumn } = await import('@/lib/db-schema')
    const {
      buildMultimodalDigestDocuments,
      extractPdfDigestWithDoubao,
      isDoubaoMultimodalModel,
    } = await import('@/lib/pdf-multimodal')

    const processed = await processPDF(buffer, file.name)
    const baseChunkCount = processed.documents.length
    let docsForVectorStore = [...processed.documents]
    let multimodalEnhanced = false

    try {
      await ensureAiModelColumn()
      const sql = getSql()
      const configRows = await sql`
        SELECT anthropic_api_key, anthropic_base_url, ai_model
        FROM users
        WHERE id = ${authResult.user.id}
        LIMIT 1
      `

      const userConfig = configRows[0] as UserAiConfigRow | undefined
      const apiKey = userConfig?.anthropic_api_key?.trim() || ''
      const baseURL = userConfig?.anthropic_base_url?.trim() || ''
      const model = userConfig?.ai_model?.trim() || ''

      const canUseMultimodal =
        apiKey &&
        baseURL &&
        model &&
        fileSizeMB <= MULTIMODAL_MAX_FILE_SIZE_MB &&
        isDoubaoMultimodalModel(model, baseURL)

      if (canUseMultimodal) {
        const digest = await extractPdfDigestWithDoubao(buffer, file.name, {
          apiKey,
          baseURL,
          model,
        })

        if (digest) {
          const digestDocs = buildMultimodalDigestDocuments(file.name, digest)
          if (digestDocs.length > 0) {
            docsForVectorStore = [...docsForVectorStore, ...digestDocs]
            multimodalEnhanced = true
          }
        }
      }
    } catch (multimodalError) {
      console.warn('Multimodal digest skipped:', multimodalError)
    }

    const vectorStore = getVectorStore()
    await vectorStore.initialize()
    await vectorStore.addDocuments(docsForVectorStore, authResult.user.id)

    return NextResponse.json({
      success: true,
      message: '文档上传成功',
      data: {
        filename: file.name,
        totalPages: processed.totalPages,
        chunks: docsForVectorStore.length,
        baseChunks: baseChunkCount,
        multimodalChunks: Math.max(0, docsForVectorStore.length - baseChunkCount),
        multimodalEnhanced,
        sizeMB: fileSizeMB.toFixed(2),
      },
    })
  } catch (error) {
    console.error('上传失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传失败' },
      { status: 500 }
    )
  }
}
