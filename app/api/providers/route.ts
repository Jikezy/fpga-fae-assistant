import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getProviders, createProvider } from '@/lib/provider-db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const providers = await getProviders(authResult.user.id)
    // 隐藏 API Key
    const safe = providers.map(p => ({
      ...p,
      api_key: p.api_key ? '••••••' + p.api_key.slice(-4) : '',
    }))
    return NextResponse.json({ providers: safe })
  } catch (error) {
    console.error('获取供应商列表失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const data = await req.json()

    if (!data.name || !data.base_url || !data.api_key || !data.model) {
      return NextResponse.json({ error: '名称、Base URL、API Key、模型为必填项' }, { status: 400 })
    }

    const provider = await createProvider(authResult.user.id, data)
    return NextResponse.json({
      provider: { ...provider, api_key: '••••••' + provider.api_key.slice(-4) },
    })
  } catch (error) {
    console.error('创建供应商失败:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500 })
  }
}
