import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getProxyStats } from '@/lib/provider-db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const range = req.nextUrl.searchParams.get('range') || '7d'
    const stats = await getProxyStats(authResult.user.id, range)
    return NextResponse.json(stats)
  } catch (error) {
    return NextResponse.json({ error: '获取统计失败' }, { status: 500 })
  }
}
