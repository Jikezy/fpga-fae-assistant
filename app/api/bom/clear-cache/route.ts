import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getSql } from '@/lib/db-schema'

export const runtime = 'nodejs'

/**
 * DELETE /api/bom/clear-cache
 * 清除价格缓存（用于测试或强制刷新）
 */
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const sql = getSql()

    // 清除所有过期或需要重新搜索的缓存
    await sql`DELETE FROM price_cache WHERE platform = 'taobao'`

    return NextResponse.json({
      success: true,
      message: '缓存已清除，请重新搜索',
    })
  } catch (error) {
    console.error('清除缓存错误:', error)
    return NextResponse.json(
      { error: '清除缓存失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
