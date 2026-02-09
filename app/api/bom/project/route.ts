import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getProjects, getProject, deleteProject, getItems, updateProject, deleteItem } from '@/lib/bom-db'
import { getSql } from '@/lib/db-schema'

export const runtime = 'nodejs'

/**
 * GET /api/bom/project?id=xxx
 * 获取项目列表或单个项目详情
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const projectId = req.nextUrl.searchParams.get('id')

    if (projectId) {
      // 获取单个项目及其元器件
      const project = await getProject(projectId, authResult.user.id)
      if (!project) {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 })
      }
      const items = await getItems(projectId)

      // 计算总价
      let totalPrice = 0
      for (const item of items) {
        if ((item as any).best_price) {
          totalPrice += parseFloat((item as any).best_price) * (item as any).quantity
        }
      }

      return NextResponse.json({ project, items, totalPrice })
    }

    // 获取项目列表
    const projects = await getProjects(authResult.user.id)
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('获取项目错误:', error)
    return NextResponse.json(
      { error: '获取失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/bom/project
 * 更新项目
 */
export async function PUT(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const { id, name, status } = await req.json()
    if (!id) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 })
    }

    await updateProject(id, authResult.user.id, { name, status })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新项目错误:', error)
    return NextResponse.json(
      { error: '更新失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/bom/project
 * 更新单个元器件的搜索关键词
 * Body: { itemId, searchKeyword }
 */
export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const { itemId, searchKeyword } = await req.json()

    if (!itemId || typeof searchKeyword !== 'string') {
      return NextResponse.json({ error: '缺少 itemId 或 searchKeyword' }, { status: 400 })
    }

    const sql = getSql()

    // 验证该 item 属于当前用户的项目
    const rows = await sql`
      SELECT bi.id FROM bom_items bi
      JOIN bom_projects bp ON bi.project_id = bp.id
      WHERE bi.id = ${itemId} AND bp.user_id = ${authResult.user.id}
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: '元器件不存在' }, { status: 404 })
    }

    await sql`UPDATE bom_items SET search_keyword = ${searchKeyword.trim()} WHERE id = ${itemId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新元器件错误:', error)
    return NextResponse.json(
      { error: '更新失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/bom/project?id=xxx  — 删除整个项目
 * DELETE /api/bom/project?itemId=xxx  — 删除单个元器件
 */
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const projectId = req.nextUrl.searchParams.get('id')
    const itemId = req.nextUrl.searchParams.get('itemId')

    if (itemId) {
      // 删除单个元器件
      const sql = getSql()

      // 验证该 item 属于当前用户的项目，并获取 project_id
      const rows = await sql`
        SELECT bi.id, bi.project_id FROM bom_items bi
        JOIN bom_projects bp ON bi.project_id = bp.id
        WHERE bi.id = ${itemId} AND bp.user_id = ${authResult.user.id}
        LIMIT 1
      `
      if (rows.length === 0) {
        return NextResponse.json({ error: '元器件不存在' }, { status: 404 })
      }

      await deleteItem(itemId, (rows[0] as any).project_id)
      return NextResponse.json({ success: true })
    }

    if (projectId) {
      await deleteProject(projectId, authResult.user.id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: '缺少 id 或 itemId 参数' }, { status: 400 })
  } catch (error) {
    console.error('删除错误:', error)
    return NextResponse.json(
      { error: '删除失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
