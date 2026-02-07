import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getSql } from '@/lib/db-schema'

export const runtime = 'nodejs'

/**
 * 获取当前用户的API配置
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const sql = getSql()
    const result = await sql`
      SELECT anthropic_api_key, anthropic_base_url
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

    return NextResponse.json({
      success: true,
      hasApiKey: !!user.anthropic_api_key,
      anthropic_base_url: user.anthropic_base_url || '',
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
 * 更新用户的API配置
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  try {
    const { anthropic_api_key, anthropic_base_url } = await req.json()

    if (!anthropic_api_key) {
      return NextResponse.json(
        { error: 'API Key 不能为空' },
        { status: 400 }
      )
    }

    // 验证API Key格式
    if (!anthropic_api_key.startsWith('sk-')) {
      return NextResponse.json(
        { error: 'API Key 格式不正确（应以 sk- 开头）' },
        { status: 400 }
      )
    }

    const sql = getSql()
    await sql`
      UPDATE users
      SET
        anthropic_api_key = ${anthropic_api_key},
        anthropic_base_url = ${anthropic_base_url || 'https://yunwu.ai'}
      WHERE id = ${authResult.user.id}
    `

    return NextResponse.json({
      success: true,
      message: 'API配置已保存',
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
 * 删除用户的API配置
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
        anthropic_base_url = NULL
      WHERE id = ${authResult.user.id}
    `

    return NextResponse.json({
      success: true,
      message: 'API配置已删除',
    })
  } catch (error) {
    console.error('删除API配置失败:', error)
    return NextResponse.json(
      { error: '删除配置失败' },
      { status: 500 }
    )
  }
}
