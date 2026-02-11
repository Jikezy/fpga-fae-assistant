import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getProvider, updateProvider, deleteProvider, setActiveProvider } from '@/lib/provider-db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const provider = await getProvider(params.id, authResult.user.id)
    if (!provider) return NextResponse.json({ error: '供应商不存在' }, { status: 404 })

    return NextResponse.json({
      provider: { ...provider, api_key: '••••••' + provider.api_key.slice(-4) },
    })
  } catch (error) {
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const data = await req.json()
    // 如果 api_key 是掩码，不更新
    if (data.api_key && data.api_key.startsWith('••••••')) {
      delete data.api_key
    }
    await updateProvider(params.id, authResult.user.id, data)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    await deleteProvider(params.id, authResult.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const { action } = await req.json()

    if (action === 'activate') {
      await setActiveProvider(params.id, authResult.user.id)
      return NextResponse.json({ success: true })
    }

    if (action === 'test') {
      const provider = await getProvider(params.id, authResult.user.id)
      if (!provider) return NextResponse.json({ error: '供应商不存在' }, { status: 404 })

      // 简单测试：发送一个最小请求
      try {
        const { detectFormat } = await import('@/lib/format-converter')
        const format = provider.api_format === 'auto'
          ? detectFormat(provider.base_url, provider.model)
          : provider.api_format

        let url: string
        let headers: Record<string, string>
        let body: any

        if (format === 'anthropic') {
          url = `${provider.base_url}/messages`
          headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.api_key}`,
            'x-api-key': provider.api_key,
            'anthropic-version': '2023-06-01',
          }
          body = { model: provider.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 }
        } else {
          url = `${provider.base_url}/chat/completions`
          headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.api_key}`,
          }
          body = { model: provider.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 }
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (response.ok) {
          const { updateHealthStatus } = await import('@/lib/provider-db')
          await updateHealthStatus(provider.id, 'healthy', 0)
          return NextResponse.json({ success: true, message: '连接成功' })
        } else {
          const errorText = await response.text().catch(() => '')
          return NextResponse.json({ success: false, message: `连接失败 (${response.status}): ${errorText.substring(0, 200)}` })
        }
      } catch (err) {
        return NextResponse.json({
          success: false,
          message: `连接失败: ${err instanceof Error ? err.message : '未知错误'}`,
        })
      }
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
