import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { reorderProviders } from '@/lib/provider-db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const { orderedIds } = await req.json()
    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds 必须为数组' }, { status: 400 })
    }

    await reorderProviders(authResult.user.id, orderedIds)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '排序失败' }, { status: 500 })
  }
}
