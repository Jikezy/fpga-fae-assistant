'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import LiquidGlassBackground from '@/components/LiquidGlassBackground'

interface Product {
  itemId: string
  title: string
  price: string
  originalPrice: string
  sales: string
  shopName: string
  shopScore: string
  buyUrl: string
  taoToken: string
  couponInfo: string
  platform: 'taobao' | 'tmall'
}

interface BomItem {
  id: string
  raw_input: string
  parsed_name: string
  parsed_spec: string
  search_keyword: string
  quantity: number
  status: string
  best_price: number | null
  buy_url: string | null
  tao_token: string | null
  search_results: Product[] | null
}

interface Project {
  id: string
  name: string
  status: string
  created_at: string
}

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [items, setItems] = useState<BomItem[]>([])
  const [totalPrice, setTotalPrice] = useState(0)
  const [loading, setLoading] = useState(true)
  const [apiConfigured, setApiConfigured] = useState(false)
  const [searchingId, setSearchingId] = useState<string | null>(null)
  const [searchAllLoading, setSearchAllLoading] = useState(false)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null)
  const [editKeywordValue, setEditKeywordValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchProject()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/bom/project?id=${projectId}`)
      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 404) { router.push('/bom'); return }
      const data = await res.json()
      setProject(data.project)
      setItems(data.items || [])
      setTotalPrice(data.totalPrice || 0)
    } catch (error) {
      console.error('获取项目失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchItem = async (item: BomItem) => {
    setSearchingId(item.id)
    try {
      const res = await fetch('/api/bom/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: item.search_keyword || item.parsed_name,
          itemId: item.id,
        }),
      })
      const data = await res.json()

      if (data.apiConfigured !== undefined) {
        setApiConfigured(data.apiConfigured)
      }

      setItems(prev => {
        const updated = prev.map(i => {
          if (i.id === item.id) {
            const products = data.products || []
            const best = products[0]
            return {
              ...i,
              search_results: products,
              best_price: best && best.price ? parseFloat(best.price) : null,
              buy_url: best?.buyUrl || null,
              tao_token: best?.taoToken || null,
              status: products.length > 0 ? 'found' : 'pending',
            }
          }
          return i
        })
        let total = 0
        for (const it of updated) {
          if (it.best_price) total += it.best_price * it.quantity
        }
        setTotalPrice(total)
        return updated
      })
    } catch (error) {
      console.error('搜索失败:', error)
    } finally {
      setSearchingId(null)
    }
  }

  const searchAll = async () => {
    setSearchAllLoading(true)
    for (const item of items) {
      if (item.status === 'pending' || !item.search_results) {
        await searchItem(item)
        await new Promise(r => setTimeout(r, 500))
      }
    }
    setSearchAllLoading(false)
  }

  const getTaobaoSearchUrl = (keyword: string) =>
    `https://s.taobao.com/search?q=${encodeURIComponent(keyword)}&sort=sale-desc`

  // 一键打开所有淘宝链接（用延时绕过浏览器弹窗拦截）
  const openAllLinks = () => {
    const urls = items.map(item => {
      const keyword = item.search_keyword || item.parsed_name || item.raw_input
      return (apiConfigured && item.buy_url) ? item.buy_url : getTaobaoSearchUrl(keyword)
    })
    // 第一个立即打开（用户点击上下文内，不会被拦截）
    if (urls.length > 0) {
      window.open(urls[0], '_blank')
    }
    // 后续的用延时逐个打开
    for (let i = 1; i < urls.length; i++) {
      setTimeout(() => {
        window.open(urls[i], '_blank')
      }, i * 500)
    }
    if (urls.length > 1) {
      alert(`正在打开 ${urls.length} 个链接，如果浏览器拦截了弹窗，请点击地址栏右侧的拦截提示，选择"始终允许"后重试。`)
    }
  }

  // 复制所有链接
  const copyAllLinks = () => {
    const text = items
      .map(i => {
        const keyword = i.search_keyword || i.parsed_name || i.raw_input
        const url = (apiConfigured && i.buy_url) ? i.buy_url : getTaobaoSearchUrl(keyword)
        return `${i.parsed_name || i.raw_input} x${i.quantity}: ${url}`
      })
      .join('\n')

    if (text) {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const exportCSV = () => {
    const isMock = !apiConfigured
    const headers = isMock
      ? ['元器件', '规格', '数量', '搜索关键词', '淘宝搜索链接']
      : ['元器件', '规格', '数量', '单价(元)', '小计(元)', '购买链接']

    const rows = items.map(item => {
      const keyword = item.search_keyword || item.parsed_name || item.raw_input
      if (isMock) {
        return [
          item.parsed_name || item.raw_input,
          item.parsed_spec || '',
          String(item.quantity),
          keyword,
          getTaobaoSearchUrl(keyword),
        ]
      }
      return [
        item.parsed_name || item.raw_input,
        item.parsed_spec || '',
        String(item.quantity),
        item.best_price ? String(item.best_price) : '',
        item.best_price ? String((item.best_price * item.quantity).toFixed(2)) : '',
        item.buy_url || getTaobaoSearchUrl(keyword),
      ]
    })

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project?.name || 'BOM'}_采购清单.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 编辑搜索关键词
  const startEditKeyword = (item: BomItem) => {
    setEditingKeyword(item.id)
    setEditKeywordValue(item.search_keyword || item.parsed_name || '')
  }

  const saveKeyword = async (itemId: string) => {
    if (!editKeywordValue.trim()) return
    try {
      const res = await fetch('/api/bom/project', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, searchKeyword: editKeywordValue.trim() }),
      })
      if (res.ok) {
        setItems(prev => prev.map(i =>
          i.id === itemId ? { ...i, search_keyword: editKeywordValue.trim() } : i
        ))
      }
    } catch (error) {
      console.error('更新关键词失败:', error)
    }
    setEditingKeyword(null)
  }

  // 删除单个元器件
  const deleteItemHandler = async (itemId: string) => {
    setDeletingId(itemId)
    try {
      const res = await fetch(`/api/bom/project?itemId=${itemId}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== itemId))
      }
    } catch (error) {
      console.error('删除元器件失败:', error)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isMock = !apiConfigured

  return (
    <div className="min-h-screen relative overflow-hidden">
      <LiquidGlassBackground />
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100/15 via-transparent to-orange-100/20 z-0" />

      <div className="relative z-10">
        {/* Header */}
        <header className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] border-b border-gray-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/bom" className="text-gray-500 hover:text-gray-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{project?.name}</h1>
                <p className="text-sm text-gray-500">{items.length} 种元器件</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isMock && totalPrice > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2">
                  <span className="text-sm text-gray-600">估算总价：</span>
                  <span className="text-lg font-bold text-orange-600">¥{totalPrice.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mock 模式提示 */}
        {isMock && (
          <div className="container mx-auto px-4 pt-4 max-w-6xl">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-800">淘宝联盟 API 未配置</p>
                <p className="text-sm text-blue-600 mt-1">
                  点击「去淘宝搜」可跳转淘宝查看实时价格。配置淘宝联盟 API Key 后将自动获取实时价格和购买链接。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="container mx-auto px-4 py-4 max-w-6xl">
          <div className="flex flex-wrap gap-3">
            {/* 真实 API 模式下才显示"一键搜索" */}
            {!isMock && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={searchAll}
                disabled={searchAllLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-400 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {searchAllLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 搜索中...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> 一键搜索全部</>
                )}
              </motion.button>
            )}

            {/* 一键打开所有淘宝链接 */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openAllLinks}
              className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold rounded-xl shadow-lg flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              一键打开所有链接
            </motion.button>

            <button
              onClick={copyAllLinks}
              className="px-5 py-2.5 bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-white transition-all flex items-center gap-2"
            >
              {copied ? (
                <><svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> 已复制</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg> 复制全部链接</>
              )}
            </button>

            <button
              onClick={exportCSV}
              className="px-5 py-2.5 bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-white transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              导出 CSV
            </button>
          </div>
        </div>

        {/* Items Table */}
        <div className="container mx-auto px-4 pb-8 max-w-6xl">
          <div className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-[60px] backdrop-saturate-[200%] rounded-2xl border border-gray-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden">
            {/* Table Header */}
            <div className={`hidden md:grid gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-sm font-medium text-gray-500 ${isMock ? 'grid-cols-10' : 'grid-cols-12'}`}>
              <div className="col-span-1">#</div>
              <div className={isMock ? 'col-span-3' : 'col-span-3'}>元器件</div>
              <div className="col-span-2">搜索关键词</div>
              <div className="col-span-1">数量</div>
              {!isMock && (
                <>
                  <div className="col-span-1">单价</div>
                  <div className="col-span-1">小计</div>
                </>
              )}
              <div className="col-span-3">操作</div>
            </div>

            {/* Table Body */}
            {items.map((item, index) => {
              const keyword = item.search_keyword || item.parsed_name || item.raw_input
              const searchUrl = (apiConfigured && item.buy_url) ? item.buy_url : getTaobaoSearchUrl(keyword)

              return (
                <div key={item.id}>
                  {/* Desktop table row */}
                  <div className={`hidden md:grid gap-4 px-6 py-4 border-b border-gray-100 items-center hover:bg-orange-50/30 transition-colors ${isMock ? 'grid-cols-10' : 'grid-cols-12'}`}>
                    <div className="col-span-1 text-sm text-gray-400">{index + 1}</div>
                    <div className="col-span-3">
                      <p className="font-medium text-gray-800 text-sm">{item.parsed_name || item.raw_input}</p>
                      {item.parsed_spec && <p className="text-xs text-gray-500 mt-0.5">{item.parsed_spec}</p>}
                    </div>
                    <div className="col-span-2">
                      {editingKeyword === item.id ? (
                        <input
                          type="text"
                          value={editKeywordValue}
                          onChange={e => setEditKeywordValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveKeyword(item.id)
                            if (e.key === 'Escape') setEditingKeyword(null)
                          }}
                          onBlur={() => saveKeyword(item.id)}
                          autoFocus
                          className="w-full px-2 py-1 text-sm border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                        />
                      ) : (
                        <button
                          onClick={() => startEditKeyword(item)}
                          className="text-sm text-gray-600 hover:text-orange-600 hover:underline cursor-pointer text-left truncate max-w-full"
                          title="点击编辑搜索关键词"
                        >
                          {keyword}
                        </button>
                      )}
                    </div>
                    <div className="col-span-1">
                      <span className="text-sm text-gray-800">{item.quantity}</span>
                    </div>
                    {!isMock && (
                      <>
                        <div className="col-span-1">
                          {item.best_price ? (
                            <span className="text-sm font-medium text-orange-600">¥{item.best_price}</span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                        <div className="col-span-1">
                          {item.best_price ? (
                            <span className="text-sm font-bold text-orange-600">
                              ¥{(item.best_price * item.quantity).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </>
                    )}
                    <div className="col-span-3 flex items-center gap-2">
                      {!isMock && (
                        <button
                          onClick={() => searchItem(item)}
                          disabled={searchingId === item.id}
                          className="px-3 py-1.5 bg-orange-50 text-orange-600 text-xs font-medium rounded-lg hover:bg-orange-100 transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          {searchingId === item.id ? (
                            <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          )}
                          搜索
                        </button>
                      )}

                      <a
                        href={searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-all"
                      >
                        去淘宝搜
                      </a>

                      <button
                        onClick={() => deleteItemHandler(item.id)}
                        disabled={deletingId === item.id}
                        className="px-3 py-1.5 bg-gray-50 text-gray-500 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50"
                        title="删除此元器件"
                      >
                        {deletingId === item.id ? (
                          <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        )}
                      </button>

                      {!isMock && item.search_results && item.search_results.length > 0 && (
                        <button
                          onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                          className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition-all"
                        >
                          {expandedItem === item.id ? '收起' : `${item.search_results.length}个结果`}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile card layout */}
                  <div className="md:hidden px-4 py-3 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{item.parsed_name || item.raw_input}</p>
                        {item.parsed_spec && <p className="text-xs text-gray-500 mt-0.5">{item.parsed_spec}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">x{item.quantity}</span>
                        <button
                          onClick={() => deleteItemHandler(item.id)}
                          disabled={deletingId === item.id}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                    {/* 搜索关键词编辑 */}
                    <div className="mb-2">
                      {editingKeyword === item.id ? (
                        <input
                          type="text"
                          value={editKeywordValue}
                          onChange={e => setEditKeywordValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveKeyword(item.id)
                            if (e.key === 'Escape') setEditingKeyword(null)
                          }}
                          onBlur={() => saveKeyword(item.id)}
                          autoFocus
                          className="w-full px-2 py-1 text-xs border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                        />
                      ) : (
                        <button
                          onClick={() => startEditKeyword(item)}
                          className="text-xs text-gray-500 hover:text-orange-600 truncate max-w-full"
                        >
                          关键词: {keyword}
                        </button>
                      )}
                    </div>
                    {/* 价格（仅真实 API 模式） */}
                    {!isMock && item.best_price && (
                      <div className="mb-2">
                        <span className="text-xs font-bold text-orange-600">
                          ¥{item.best_price} / 小计 ¥{(item.best_price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {!isMock && (
                        <button
                          onClick={() => searchItem(item)}
                          disabled={searchingId === item.id}
                          className="px-3 py-2 bg-orange-50 text-orange-600 text-xs font-medium rounded-lg hover:bg-orange-100 transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          {searchingId === item.id ? (
                            <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          )}
                          搜索
                        </button>
                      )}
                      <a
                        href={searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-all"
                      >
                        去淘宝搜
                      </a>
                      {!isMock && item.search_results && item.search_results.length > 0 && (
                        <button
                          onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                          className="px-3 py-2 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition-all"
                        >
                          {expandedItem === item.id ? '收起' : `${item.search_results.length}个结果`}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 展开的搜索结果（仅真实 API 模式） */}
                  {!isMock && expandedItem === item.id && item.search_results && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-gray-50/50 px-4 sm:px-6 py-4 border-b border-gray-200"
                    >
                      <div className="space-y-3">
                        {item.search_results.map((product: Product, pi: number) => (
                          <div
                            key={pi}
                            className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-xl p-4 border border-gray-100 hover:border-orange-200 transition-all gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 mb-1">{product.title}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span className="px-1.5 py-0.5 rounded text-xs bg-orange-50 text-orange-600">
                                  {product.platform === 'tmall' ? '天猫' : '淘宝'}
                                </span>
                                {product.shopName && <span>{product.shopName}</span>}
                                {product.sales && <span>月销 {product.sales}</span>}
                                {product.couponInfo && (
                                  <span className="text-red-500">{product.couponInfo}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 sm:ml-4">
                              {product.price && (
                                <div className="text-left sm:text-right">
                                  <p className="text-base sm:text-lg font-bold text-orange-600">
                                    ¥{product.price}
                                  </p>
                                  {product.originalPrice && product.originalPrice !== product.price && (
                                    <p className="text-xs text-gray-400 line-through">¥{product.originalPrice}</p>
                                  )}
                                </div>
                              )}
                              <a
                                href={product.buyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-400 text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all whitespace-nowrap"
                              >
                                购买
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              )
            })}

            {items.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400">
                <p>暂无元器件</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
