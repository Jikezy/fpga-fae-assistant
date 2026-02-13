/**
 * 淘宝联盟（淘宝客）API 客户端
 * 未配置 API Key 时自动使用 mock 模式（只返回搜索链接，不返回假价格）
 */

import { createHash } from 'crypto'

// 商品搜索结果
export interface TaobaoProduct {
  itemId: string
  title: string
  price: string
  originalPrice: string
  sales: string
  shopName: string
  shopScore: string
  imageUrl: string
  buyUrl: string
  taoToken: string
  couponInfo: string
  couponAmount: string
  commissionRate: string
  platform: 'taobao' | 'tmall'
}

// 搜索参数
export interface SearchParams {
  keyword: string
  sort?: 'total_sales_des' | 'price_asc' | 'price_des' | 'tk_rate_des'
  pageSize?: number
  pageNo?: number
  hasCoupon?: boolean
}

class TaobaoClient {
  private appKey: string
  private appSecret: string
  private pid: string
  private adzoneId: string
  private isMock: boolean
  public lastError: string = ''

  constructor() {
    this.appKey = process.env.TAOBAO_APP_KEY || ''
    this.appSecret = process.env.TAOBAO_APP_SECRET || ''
    this.pid = (process.env.TAOBAO_PID || '').trim()
    this.adzoneId = this.extractAdzoneId(this.pid)
    this.isMock = !this.appKey || !this.appSecret || !this.adzoneId

    if (!this.adzoneId) {
      this.lastError = 'TAOBAO_PID invalid: unable to extract adzone_id'
    }
  }

  private extractAdzoneId(pid: string): string {
    if (!pid) return ''

    if (/^\d+$/.test(pid)) {
      return pid
    }

    const normalized = pid.replace(/^mm_/, '')
    const parts = normalized.split('_').filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : ''
  }

  private formatTimestampGmt8(date = new Date()): string {
    const gmt8 = new Date(date.getTime() + 8 * 60 * 60 * 1000)
    const yyyy = gmt8.getUTCFullYear()
    const mm = String(gmt8.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(gmt8.getUTCDate()).padStart(2, '0')
    const hh = String(gmt8.getUTCHours()).padStart(2, '0')
    const mi = String(gmt8.getUTCMinutes()).padStart(2, '0')
    const ss = String(gmt8.getUTCSeconds()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  }

  private normalizeUrl(url: string | undefined): string {
    if (!url) return ''
    if (url.startsWith('//')) return `https:${url}`
    if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`
    return url
  }

  private formatCommissionRate(raw: unknown): string {
    if (raw === null || raw === undefined) return ''
    const text = String(raw).trim()
    if (!text) return ''
    return text.endsWith('%') ? text : `${text}%`
  }

  private mapProduct(item: any): TaobaoProduct {
    const basic = item?.item_basic_info || item || {}
    const priceInfo = item?.price_promotion_info || item || {}
    const publishInfo = item?.publish_info || {}
    const incomeInfo = publishInfo?.income_info || {}

    const clickUrl = this.normalizeUrl(publishInfo?.click_url || item?.click_url)
    const couponShareUrl = this.normalizeUrl(publishInfo?.coupon_share_url || item?.coupon_share_url)
    const fallbackUrl = this.normalizeUrl(item?.url)

    const reservePrice = String(priceInfo?.reserve_price || item?.reserve_price || '')
    const salePrice = String(priceInfo?.zk_final_price || priceInfo?.final_promotion_price || item?.zk_final_price || reservePrice)
    const couponAmount = String(item?.coupon_amount || '')

    return {
      itemId: String(item?.item_id || ''),
      title: String(basic?.title || item?.title || ''),
      price: salePrice,
      originalPrice: reservePrice,
      sales: basic?.volume || item?.volume ? `${basic?.volume || item?.volume}\u4eba\u4ed8\u6b3e` : '',
      shopName: String(basic?.shop_title || item?.shop_title || item?.nick || ''),
      shopScore: item?.shop_dsr ? `${item.shop_dsr}/5.0` : '',
      imageUrl: this.normalizeUrl(String(basic?.pict_url || item?.pict_url || '')),
      buyUrl: couponShareUrl || clickUrl || fallbackUrl,
      taoToken: '',
      couponInfo: String(item?.coupon_info || ''),
      couponAmount: couponAmount ? `${couponAmount}\u5143` : '',
      commissionRate: this.formatCommissionRate(incomeInfo?.commission_rate || publishInfo?.income_rate || item?.commission_rate),
      platform: Number(basic?.user_type ?? item?.user_type) === 1 ? 'tmall' : 'taobao',
    }
  }

  private buildAffiliateSearchUrl(keyword: string): string {
    const encodedKeyword = encodeURIComponent(keyword)
    if (!this.pid || !this.adzoneId) {
      return `https://s.taobao.com/search?q=${encodedKeyword}&sort=sale-desc`
    }

    return `https://uland.taobao.com/sem/tbsearch?refpid=${this.pid}&keyword=${encodedKeyword}&clk1=&upsId=${this.adzoneId}`
  }

  /**
   * Generate API signature
   */
  private sign(params: Record<string, string>): string {
    const sorted = Object.keys(params).sort()
    let str = this.appSecret
    for (const key of sorted) {
      str += key + params[key]
    }
    str += this.appSecret
    return createHash('md5').update(str).digest('hex').toUpperCase()
  }

  /**
   * 调用淘宝联盟 API
   */
  private async callApi(method: string, params: Record<string, string>): Promise<any> {
    const baseParams: Record<string, string> = {
      method,
      app_key: this.appKey,
      timestamp: this.formatTimestampGmt8(),
      format: 'json',
      simplify: 'true',
      v: '2.0',
      sign_method: 'md5',
      ...params,
    }

    baseParams.sign = this.sign(baseParams)

    const url = 'https://eco.taobao.com/router/rest?' + new URLSearchParams(baseParams).toString()

    const response = await fetch(url, { method: 'GET' })
    if (!response.ok) {
      throw new Error(`Taobao API request failed: ${response.status}`)
    }
    return response.json()
  }

  async searchProducts(params: SearchParams): Promise<TaobaoProduct[]> {
    if (this.isMock) {
      console.log('[TaobaoClient] mock mode, using affiliate search links')
      return this.mockSearch(params.keyword)
    }

    const result = await this.tryDgMaterialSearch(params)
    if (result.success) {
      console.log('[TaobaoClient] DG API success')
      this.lastError = ''
      return result.products
    }

    console.log('[TaobaoClient] API search failed, fallback to affiliate search link')
    this.lastError = result.error
    return this.fallbackSearch(params.keyword)
  }

  private async tryDgMaterialSearch(params: SearchParams): Promise<{ success: boolean; products: TaobaoProduct[]; error: string }> {
    const apiParams: Record<string, string> = {
      q: params.keyword,
      adzone_id: this.adzoneId,
      page_size: (params.pageSize || 20).toString(),
      page_no: (params.pageNo || 1).toString(),
    }

    if (params.sort) {
      apiParams.sort = params.sort
    }

    if (params.hasCoupon) {
      apiParams.has_coupon = 'true'
    }

    try {
      console.log('[TaobaoClient] trying DG API: taobao.tbk.dg.material.optional.upgrade')

      const result = await this.callApi('taobao.tbk.dg.material.optional.upgrade', apiParams)
      if (result.error_response) {
        const error = `DG API error: ${result.error_response.sub_msg || result.error_response.msg} (${result.error_response.code})`
        console.warn('[TaobaoClient]', error)

        const legacy = await this.tryLegacyDgMaterialSearch(apiParams)
        if (legacy.success) {
          return legacy
        }

        return { success: false, products: [], error: `${error} | ${legacy.error}` }
      }

      const data = result?.tbk_dg_material_optional_upgrade_response?.result_list?.map_data || result?.result_list
      if (!Array.isArray(data) || data.length === 0) {
        return { success: false, products: [], error: 'DG API returned no products' }
      }

      const products = data.map((item: any) => this.mapProduct(item)).filter((item: TaobaoProduct) => !!item.buyUrl)
      if (products.length === 0) {
        return { success: false, products: [], error: 'DG API returned products without links' }
      }

      return { success: true, products, error: '' }
    } catch (error: any) {
      const msg = `DG API exception: ${error.message}`
      console.warn('[TaobaoClient]', msg)

      const legacy = await this.tryLegacyDgMaterialSearch(apiParams)
      if (legacy.success) {
        return legacy
      }

      return { success: false, products: [], error: `${msg} | ${legacy.error}` }
    }
  }

  private async tryLegacyDgMaterialSearch(apiParams: Record<string, string>): Promise<{ success: boolean; products: TaobaoProduct[]; error: string }> {
    try {
      console.log('[TaobaoClient] fallback to legacy API: taobao.tbk.dg.material.optional')
      const result = await this.callApi('taobao.tbk.dg.material.optional', apiParams)

      if (result.error_response) {
        const error = `Legacy API error: ${result.error_response.sub_msg || result.error_response.msg} (${result.error_response.code})`
        console.warn('[TaobaoClient]', error)
        return { success: false, products: [], error }
      }

      const data = result?.tbk_dg_material_optional_response?.result_list?.map_data || result?.result_list
      if (!Array.isArray(data) || data.length === 0) {
        return { success: false, products: [], error: 'Legacy API returned no products' }
      }

      const products = data.map((item: any) => this.mapProduct(item)).filter((item: TaobaoProduct) => !!item.buyUrl)
      if (products.length === 0) {
        return { success: false, products: [], error: 'Legacy API returned products without links' }
      }

      return { success: true, products, error: '' }
    } catch (error: any) {
      const msg = `Legacy API exception: ${error.message}`
      console.warn('[TaobaoClient]', msg)
      return { success: false, products: [], error: msg }
    }
  }

  private fallbackSearch(keyword: string): TaobaoProduct[] {
    const unionUrl = this.buildAffiliateSearchUrl(keyword)

    return [{
      itemId: `fallback_${Date.now()}`,
      title: `Search on Taobao: ${keyword}`,
      price: '',
      originalPrice: '',
      sales: '',
      shopName: 'Taobao Affiliate',
      shopScore: '',
      imageUrl: '',
      buyUrl: unionUrl,
      taoToken: '',
      couponInfo: '',
      couponAmount: '',
      commissionRate: '',
      platform: 'taobao' as const,
    }]
  }

  async createTaoToken(url: string, title: string): Promise<string> {
    if (this.isMock) {
      return ''
    }

    try {
      const result = await this.callApi('taobao.tbk.tpwd.create', {
        text: title.substring(0, 12), // 淘口令文案限制12字符
        url: url,
        logo: '', // 可选：品牌logo
      })

      const data = result?.tbk_tpwd_create_response?.data
      if (data?.model) {
        return data.model
      }

      this.lastError = '淘口令生成失败'
      return ''
    } catch (error: any) {
      this.lastError = `淘口令生成异常: ${error.message}`
      console.error('[TaobaoClient] 淘口令生成失败:', error)
      return ''
    }
  }

  /**
   * 长链转短链
   * 使用淘宝联盟 API: taobao.tbk.spread.get
   */
  async convertToShortUrl(url: string): Promise<string> {
    if (this.isMock) {
      return url
    }

    try {
      const result = await this.callApi('taobao.tbk.spread.get', {
        requests: JSON.stringify([{
          url: url,
          material_id: '', // 可选：物料ID
        }]),
      })

      const data = result?.tbk_spread_get_response?.results?.tbk_spread
      if (data && data.length > 0) {
        return data[0].short_url || url
      }

      return url
    } catch (error: any) {
      console.error('[TaobaoClient] 长链转短链失败:', error)
      return url
    }
  }

  /**
   * 获取商品详情（需要权限 27939）
   * Use Taobao API: taobao.tbk.dg.material.optional.upgrade
   */
  async getProductDetail(itemId: string): Promise<TaobaoProduct | null> {
    if (this.isMock) {
      return null
    }

    try {
      const result = await this.callApi('taobao.tbk.dg.material.optional.upgrade', {
        item_id: itemId,
        adzone_id: this.adzoneId,
        page_size: '1',
        page_no: '1',
      })

      if (result.error_response) {
        console.warn('[TaobaoClient] product detail API error:', result.error_response)
        return null
      }

      const data = result?.tbk_dg_material_optional_upgrade_response?.result_list?.map_data || result?.result_list?.[0]
      if (!data) {
        return null
      }

      return this.mapProduct(data)
    } catch (error: any) {
      console.error('[TaobaoClient] getProductDetail failed:', error)
      return null
    }
  }

  /**
   * Check whether API credentials are available
   */
  isConfigured(): boolean {
    return !this.isMock
  }

  /**
   * 获取联盟推广搜索链接模板（前端用 keyword 替换占位符）
   */
  getAffiliateUrlTemplate(): string | null {
    if (!this.pid || !this.adzoneId) return null
    return `https://uland.taobao.com/sem/tbsearch?refpid=${this.pid}&keyword=__KEYWORD__&clk1=&upsId=${this.adzoneId}`
  }

  /**
   * Mock mode: only return search links, no fake prices
   */
  private mockSearch(keyword: string): TaobaoProduct[] {
    return [{
      itemId: `mock_${Date.now()}`,
      title: keyword,
      price: '',
      originalPrice: '',
      sales: '',
      shopName: '',
      shopScore: '',
      imageUrl: '',
      buyUrl: this.buildAffiliateSearchUrl(keyword),
      taoToken: '',
      couponInfo: '',
      couponAmount: '',
      commissionRate: '',
      platform: 'taobao' as const,
    }]
  }
}

// 导出单例
export const taobaoClient = new TaobaoClient()
