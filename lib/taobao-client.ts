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
   */
  async searchProducts(params: SearchParams): Promise<TaobaoProduct[]> {
    if (this.isMock) {
      return this.mockSearch(params.keyword)
    }

    try {
      // 尝试多个 API，按权限依次降级
      let result: any = null
      let items: any[] = []
      let apiUsed = ''

      // 方案1: taobao.tbk.dg.optimus.material（权限包 16189 公用物料）
      try {
        result = await this.callApi('taobao.tbk.dg.optimus.material', {
          adzone_id: this.pid.split('_').pop() || '',
          page_size: String(params.pageSize || 20),
          page_no: String(params.pageNo || 1),
          material_id: '13366', // 好券直播-全部商品
          q: params.keyword,
        })
        items = result?.tbk_dg_optimus_material_response?.result_list?.map_data || []
        apiUsed = 'optimus'
      } catch (e) {
        console.log('optimus API 失败，尝试 material.optional...')
      }

      // 方案2: taobao.tbk.dg.material.optional（权限包 27939）
      if (items.length === 0) {
        try {
          result = await this.callApi('taobao.tbk.dg.material.optional', {
            adzone_id: this.pid.split('_').pop() || '',
            q: params.keyword,
            sort: params.sort || 'total_sales_des',
            page_size: String(params.pageSize || 20),
            page_no: String(params.pageNo || 1),
            has_coupon: params.hasCoupon ? 'true' : 'false',
          })
          items = result?.tbk_dg_material_optional_response?.result_list?.map_data || []
          apiUsed = 'optional'
        } catch (e) {
          console.log('material.optional API 也失败')
        }
      }

      // 记录原始响应用于排查
      this.lastError = `[${apiUsed}] ${JSON.stringify(result).substring(0, 500)}`
      console.log(`淘宝 API [${apiUsed}] 原始响应:`, JSON.stringify(result).substring(0, 500))

      return items.map((item: any) => ({
        itemId: item.item_id || item.num_iid,
        title: item.title,
        price: item.zk_final_price,
        originalPrice: item.reserve_price,
        sales: String(item.volume || 0),
        shopName: item.shop_title,
        shopScore: item.shop_dsr || '4.8',
        imageUrl: item.pict_url,
        buyUrl: item.coupon_share_url || item.url || item.click_url,
        taoToken: '',
        couponInfo: item.coupon_info || '',
        couponAmount: item.coupon_amount || '0',
        commissionRate: item.commission_rate || '0',
        platform: item.user_type === 1 ? 'tmall' : 'taobao',
      }))
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      console.error('淘宝 API 调用失败，降级到 mock:', error)
      return this.mockSearch(params.keyword)
    }
  }

  /**
   * 生成淘口令
   */
  async createTaoToken(url: string, title: string): Promise<string> {
    if (this.isMock) {
      return ''
    }

    try {
      const result = await this.callApi('taobao.tbk.tpwd.create', {
        text: title,
        url: url,
      })
      return result?.tbk_tpwd_create_response?.data?.model || ''
    } catch {
      return ''
    }
  }

  /**
   * 检查 API 是否已配置
   */
  isConfigured(): boolean {
    return !this.isMock
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
