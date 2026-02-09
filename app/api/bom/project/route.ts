import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getProjects, getProject, deleteProject, getItems, updateProject } from '@/lib/bom-db'

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
 * DELETE /api/bom/project?id=xxx
 * 删除项目
 */
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const projectId = req.nextUrl.searchParams.get('id')
    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 })
    }

    await deleteProject(projectId, authResult.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除项目错误:', error)
    return NextResponse.json(
      { error: '删除失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
