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
  private isMock: boolean
  public lastError: string = ''

  constructor() {
    this.appKey = process.env.TAOBAO_APP_KEY || ''
    this.appSecret = process.env.TAOBAO_APP_SECRET || ''
    this.pid = process.env.TAOBAO_PID || ''
    this.isMock = !this.appKey || !this.appSecret
  }

  /**
   * 生成 API 签名
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
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
      ...params,
    }

    baseParams.sign = this.sign(baseParams)

    const url = 'https://eco.taobao.com/router/rest?' + new URLSearchParams(baseParams).toString()

    const response = await fetch(url, { method: 'GET' })
    if (!response.ok) {
      throw new Error(`淘宝 API 请求失败: ${response.status}`)
    }
    return response.json()
  }

  /**
   * 搜索商品
   * 使用淘宝联盟物料搜索 API (taobao.tbk.dg.material.optional)
   */
  async searchProducts(params: SearchParams): Promise<TaobaoProduct[]> {
    if (this.isMock) {
      console.log('[TaobaoClient] Mock 模式，返回推广链接')
      return this.mockSearch(params.keyword)
    }

    try {
      const apiParams: Record<string, string> = {
        q: params.keyword,
        adzone_id: this.pid.replace('mm_', '').split('_')[2], // 推广位ID
        page_size: (params.pageSize || 20).toString(),
        page_no: (params.pageNo || 1).toString(),
      }

      // 可选排序参数
      if (params.sort) {
        apiParams.sort = params.sort
      }

      // 可选优惠券筛选
      if (params.hasCoupon) {
        apiParams.has_coupon = 'true'
      }

      console.log('[TaobaoClient] 调用淘宝API:', {
        method: 'taobao.tbk.dg.material.optional',
        keyword: params.keyword,
        adzone_id: apiParams.adzone_id,
        appKey: this.appKey,
        hasPid: !!this.pid,
      })

      const result = await this.callApi('taobao.tbk.dg.material.optional', apiParams)

      console.log('[TaobaoClient] API 原始响应:', JSON.stringify(result).substring(0, 500))

      // 检查响应
      if (result.error_response) {
        this.lastError = `淘宝API错误: ${result.error_response.sub_msg || result.error_response.msg}`
        console.error('[TaobaoClient] API错误:', result.error_response)
        console.error('[TaobaoClient] 错误代码:', result.error_response.code)
        console.error('[TaobaoClient] 错误详情:', result.error_response.sub_code)
        return this.fallbackSearch(params.keyword)
      }

      const data = result?.tbk_dg_material_optional_response?.result_list?.map_data

      if (!data || data.length === 0) {
        this.lastError = '未找到商品'
        console.warn('[TaobaoClient] 未找到商品，完整响应:', JSON.stringify(result))
        return this.fallbackSearch(params.keyword)
      }

      this.lastError = ''
      console.log('[TaobaoClient] 成功获取商品:', data.length, '个')

      return data.map((item: any) => ({
        itemId: item.item_id,
        title: item.title,
        price: item.zk_final_price || item.reserve_price || '',
        originalPrice: item.reserve_price || '',
        sales: item.volume ? `${item.volume}人付款` : '',
        shopName: item.shop_title || item.nick || '',
        shopScore: item.shop_dsr ? `${item.shop_dsr}/5.0` : '',
        imageUrl: item.pict_url?.replace('http://', 'https://') || '',
        buyUrl: item.coupon_share_url || item.url || '',
        taoToken: '',
        couponInfo: item.coupon_info || '',
        couponAmount: item.coupon_amount ? `${item.coupon_amount}元` : '',
        commissionRate: item.commission_rate ? `${item.commission_rate}%` : '',
        platform: item.user_type === 1 ? 'tmall' : 'taobao',
      }))
    } catch (error: any) {
      this.lastError = `搜索失败: ${error.message}`
      console.error('[TaobaoClient] 搜索异常:', error)
      console.error('[TaobaoClient] 异常堆栈:', error.stack)
      return this.fallbackSearch(params.keyword)
    }
  }

  /**
   * API 失败时的降级方案：生成联盟推广搜索链接
   */
  private fallbackSearch(keyword: string): TaobaoProduct[] {
    const pidParts = this.pid.replace('mm_', '').split('_')
    const unionUrl = `https://uland.taobao.com/sem/tbsearch?refpid=${this.pid}&keyword=${encodeURIComponent(keyword)}&clk1=&upsId=${pidParts[2]}`

    return [{
      itemId: `fallback_${Date.now()}`,
      title: `在淘宝搜索: ${keyword}`,
      price: '',
      originalPrice: '',
      sales: '',
      shopName: '淘宝联盟推广',
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

  /**
   * 生成淘口令
   * 使用淘宝联盟 API: taobao.tbk.tpwd.create
   */
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
   * 使用淘宝联盟 API: taobao.tbk.sc.material.optional
   */
  async getProductDetail(itemId: string): Promise<TaobaoProduct | null> {
    if (this.isMock) {
      return null
    }

    try {
      const result = await this.callApi('taobao.tbk.sc.material.optional', {
        item_id: itemId,
        adzone_id: this.pid.replace('mm_', '').split('_')[2],
      })

      const data = result?.tbk_sc_material_optional_response?.result_list?.map_data?.[0]
      if (!data) {
        return null
      }

      return {
        itemId: data.item_id,
        title: data.title,
        price: data.zk_final_price || data.reserve_price || '',
        originalPrice: data.reserve_price || '',
        sales: data.volume ? `${data.volume}人付款` : '',
        shopName: data.shop_title || data.nick || '',
        shopScore: data.shop_dsr ? `${data.shop_dsr}/5.0` : '',
        imageUrl: data.pict_url?.replace('http://', 'https://') || '',
        buyUrl: data.coupon_share_url || data.url || '',
        taoToken: '',
        couponInfo: data.coupon_info || '',
        couponAmount: data.coupon_amount ? `${data.coupon_amount}元` : '',
        commissionRate: data.commission_rate ? `${data.commission_rate}%` : '',
        platform: data.user_type === 1 ? 'tmall' : 'taobao',
      }
    } catch (error: any) {
      console.error('[TaobaoClient] 获取商品详情失败:', error)
      return null
    }
  }

  /**
   * 检查 API 是否已配置
   */
  isConfigured(): boolean {
    return !this.isMock
  }

  /**
   * 获取联盟推广搜索链接模板（前端用 keyword 替换占位符）
   */
  getAffiliateUrlTemplate(): string | null {
    if (this.isMock || !this.pid) return null
    const pidParts = this.pid.replace('mm_', '').split('_')
    return `https://uland.taobao.com/sem/tbsearch?refpid=${this.pid}&keyword=__KEYWORD__&clk1=&upsId=${pidParts[2]}`
  }

  /**
   * Mock 模式：不返回假价格，只提供淘宝搜索链接
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
      buyUrl: `https://s.taobao.com/search?q=${encodeURIComponent(keyword)}&sort=sale-desc`,
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
