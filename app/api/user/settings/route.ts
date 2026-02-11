import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getSql, ensureAiModelColumn } from '@/lib/db-schema'

export const runtime = 'nodejs'

/**
 * 获取当前用户的AI配置
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    await ensureAiModelColumn()
    const sql = getSql()
    const result = await sql`
      SELECT anthropic_api_key, anthropic_base_url, ai_model, api_format
      FROM users
      WHERE id = ${authResult.user.id}
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    const user = result[0] as any

    // 脱敏显示 API Key：前4位 + **** + 后4位
    let maskedKey = ''
    if (user.anthropic_api_key) {
      const key = user.anthropic_api_key
      if (key.length > 8) {
        maskedKey = key.slice(0, 4) + '····' + key.slice(-4)
      } else {
        maskedKey = '****'
      }
    }

    return NextResponse.json({
      success: true,
      hasApiKey: !!user.anthropic_api_key,
      maskedKey,
      baseUrl: user.anthropic_base_url || '',
      model: user.ai_model || '',
      apiFormat: user.api_format || 'auto',
    })
  } catch (error) {
    console.error('获取API配置失败:', error)
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    )
  }
}

/**
 * 更新用户的AI配置
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const { api_key, base_url, model_name, api_format } = await req.json()

    await ensureAiModelColumn()

    if (!api_key) {
      return NextResponse.json(
        { error: 'API Key 不能为空' },
        { status: 400 }
      )
    }

    if (!base_url) {
      return NextResponse.json(
        { error: 'Base URL 不能为空' },
        { status: 400 }
      )
    }

    if (!model_name) {
      return NextResponse.json(
        { error: '模型名称不能为空' },
        { status: 400 }
      )
    }

    const format = api_format || 'auto'
    const sql = getSql()

    if (api_key === '__KEEP_EXISTING__') {
      // 仅更新 base_url、model、api_format，保留现有 API Key
      await sql`
        UPDATE users
        SET
          anthropic_base_url = ${base_url},
          ai_model = ${model_name},
          api_format = ${format}
        WHERE id = ${authResult.user.id}
      `
    } else {
      await sql`
        UPDATE users
        SET
          anthropic_api_key = ${api_key},
          anthropic_base_url = ${base_url},
          ai_model = ${model_name},
          api_format = ${format}
        WHERE id = ${authResult.user.id}
      `
    }

    return NextResponse.json({
      success: true,
      message: 'AI 配置已保存',
    })
  } catch (error) {
    console.error('保存API配置失败:', error)
    return NextResponse.json(
      { error: '保存配置失败' },
      { status: 500 }
    )
  }
}

/**
 * 删除用户的AI配置
 */
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const sql = getSql()
    await sql`
      UPDATE users
      SET
        anthropic_api_key = NULL,
        anthropic_base_url = NULL,
        ai_model = NULL,
        api_format = 'auto'
      WHERE id = ${authResult.user.id}
    `

    return NextResponse.json({
      success: true,
      message: 'AI 配置已删除',
    })
  } catch (error) {
    console.error('删除API配置失败:', error)
    return NextResponse.json(
      { error: '删除配置失败' },
      { status: 500 }
    )
  }
}
