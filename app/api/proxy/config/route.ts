import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getProxyKeys } from '@/lib/provider-db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const keys = await getProxyKeys(authResult.user.id)
    const host = req.headers.get('host') || 'your-domain.com'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}/api/proxy/v1`

    const activeKey = keys.find(k => k.is_active)
    const keyDisplay = activeKey ? activeKey.key_prefix + '••••••••' : '（请先生成代理 Key）'

    const claudeCodeConfig = {
      apiKey: keyDisplay,
      baseUrl: baseUrl,
    }

    const configSnippet = `# Claude Code 配置
# 在环境变量中设置：
export ANTHROPIC_BASE_URL="${baseUrl}"
export ANTHROPIC_API_KEY="${keyDisplay}"

# 或在 Claude Code 设置中填写：
# Base URL: ${baseUrl}
# API Key: ${keyDisplay}`

    return NextResponse.json({
      baseUrl,
      keyDisplay,
      claudeCodeConfig,
      configSnippet,
    })
  } catch (error) {
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 })
  }
}
