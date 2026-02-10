import { NextResponse } from 'next/server'

/**
 * 健康检查 API
 * 简单的服务存活检查
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    message: 'BYOK 模式 — 用户自行配置 AI 服务',
    timestamp: new Date().toISOString(),
  })
}
