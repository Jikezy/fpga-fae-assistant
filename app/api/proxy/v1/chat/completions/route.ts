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
      return new Response(JSON.stringify({ error: { message: 'Invalid API key', type: 'authentication_error' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const providers = await getProvidersForFailover(auth.userId)

    if (providers.length === 0) {
      return new Response(JSON.stringify({ error: { message: 'No providers configured', type: 'invalid_request_error' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const router = new ProviderRouter(providers)
    return router.proxyRequest({
      body,
      incomingFormat: 'openai',
      userId: auth.userId,
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: { message: 'Internal proxy error', type: 'api_error' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
