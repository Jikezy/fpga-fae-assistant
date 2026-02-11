import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createProxyKey, getProxyKeys, deleteProxyKey } from '@/lib/provider-db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const keys = await getProxyKeys(authResult.user.id)
    return NextResponse.json({ keys })
  } catch (error) {
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const { name } = await req.json().catch(() => ({ name: 'Default' }))
    const result = await createProxyKey(authResult.user.id, name || 'Default')
    // 明文 Key 仅在创建时返回一次
    return NextResponse.json({ key: result.key, record: result.record })
  } catch (error) {
    return NextResponse.json({ error: '创建失败' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: '缺少 Key ID' }, { status: 400 })

    await deleteProxyKey(id, authResult.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
