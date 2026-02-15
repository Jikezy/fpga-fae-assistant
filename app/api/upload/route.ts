import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getRAGClient } from '@/lib/ragClient'

// 使用 Node.js runtime
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // 验证用户登录
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    // 从数据库获取用户的文档列表
    const { getSql } = await import('@/lib/db-schema')
    const sql = getSql()
    const docs = await sql`
      SELECT DISTINCT source, COUNT(*) as chunks,
             MIN(created_at) as uploaded_at
      FROM documents
      WHERE user_id = ${authResult.user.id}
      GROUP BY source
      ORDER BY MIN(created_at) DESC
    `

    return NextResponse.json({
      success: true,
      documents: docs.map((d: any) => d.source),
      total: docs.reduce((sum: number, d: any) => sum + Number(d.chunks), 0),
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

    const allowedExts = ['.pdf', '.docx', '.txt']
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: '仅支持 PDF/DOCX/TXT 文件' },
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

    const ragClient = getRAGClient()

    // 1. 解析文档
    const parsed = await ragClient.parse(buffer, file.name)

    // 2. 入库（FAISS + BM25）
    await ragClient.index(authResult.user.id, parsed.chunks)

    // 3. 同时在数据库记录元数据（保持兼容）
    try {
      const { getSql } = await import('@/lib/db-schema')
      const sql = getSql()
      for (const chunk of parsed.chunks) {
        const id = crypto.randomUUID()
        await sql`
          INSERT INTO documents (id, content, source, page, title, user_id)
          VALUES (${id}, ${chunk.text}, ${file.name}, ${chunk.metadata.page || 0}, ${file.name}, ${authResult.user.id})
        `
      }
    } catch (dbError) {
      console.error('数据库记录失败（不影响检索）:', dbError)
    }

    return NextResponse.json({
      success: true,
      message: '文档上传成功',
      data: {
        filename: file.name,
        totalPages: parsed.total,
        chunks: parsed.chunks.length,
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
