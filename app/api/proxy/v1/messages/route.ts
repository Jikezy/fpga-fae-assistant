import { NextRequest } from 'next/server'
import { authenticateProxy } from '@/lib/proxy-auth'
import { getProvidersForFailover } from '@/lib/provider-db'
import { ProviderRouter } from '@/lib/provider-service'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    // 代理 Key 认证
    const auth = await authenticateProxy(req)
    if (!auth) {
      return new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'Invalid API key' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const providers = await getProvidersForFailover(auth.userId)

    if (providers.length === 0) {
      return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'No providers configured' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const router = new ProviderRouter(providers)
    return router.proxyRequest({
      body,
      incomingFormat: 'anthropic',
      userId: auth.userId,
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'Internal proxy error' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
