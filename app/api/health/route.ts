import { NextRequest, NextResponse } from 'next/server'
import { AIService } from '@/lib/ai-service'

/**
 * 健康检查 API
 * 用于检查 AI 服务是否可用
 */
export async function GET(req: NextRequest) {
  try {
    const aiService = new AIService()
    const health = await aiService.checkHealth()
    const config = aiService.getConfig()

    return NextResponse.json({
      status: health.available ? 'healthy' : 'unhealthy',
      provider: config.provider,
      model: config.model,
      message: health.message,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
