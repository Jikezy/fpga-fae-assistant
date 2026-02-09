import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { taobaoClient } from '@/lib/taobao-client'
import { getCachedSearch, setCachedSearch, updateItem } from '@/lib/bom-db'

export const runtime = 'nodejs'

/**
 * POST /api/bom/search
 * 搜索淘宝商品
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) return authResult.error

  try {
    const { keyword, itemId, sort } = await req.json()

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json({ error: '请提供搜索关键词' }, { status: 400 })
    }

    // 检查缓存
    const cached = await getCachedSearch(keyword)
    if (cached) {
      // 如果有 itemId，更新该元器件的搜索结果
      if (itemId && cached.length > 0) {
        const best = cached[0]
        await updateItem(itemId, {
          searchResults: cached,
          bestPrice: parseFloat(best.price),
          bestSource: 'taobao',
          buyUrl: best.buyUrl,
          taoToken: best.taoToken,
          status: 'found',
        })
      }

      return NextResponse.json({
        products: cached,
        fromCache: true,
        apiConfigured: taobaoClient.isConfigured(),
      })
    }

    // 调用淘宝联盟 API（或 mock）
    const products = await taobaoClient.searchProducts({
      keyword,
      sort: sort || 'total_sales_des',
      pageSize: 10,
    })

    // 写入缓存
    if (products.length > 0) {
      await setCachedSearch(keyword, products).catch(() => {})
    }

    // 如果有 itemId，更新该元器件的搜索结果
    if (itemId && products.length > 0) {
      const best = products[0]
      await updateItem(itemId, {
        searchResults: products,
        bestPrice: parseFloat(best.price),
        bestSource: 'taobao',
        buyUrl: best.buyUrl,
        taoToken: best.taoToken,
        status: 'found',
      })
    }

    return NextResponse.json({
      products,
      fromCache: false,
      apiConfigured: taobaoClient.isConfigured(),
    })
  } catch (error) {
    console.error('商品搜索错误:', error)
    return NextResponse.json(
      { error: '搜索失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
