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
   * 淘宝联盟搜索 API 权限难以获取，改用联盟推广链接方式
   * 用户点击链接后在淘宝内搜索下单，佣金通过 PID 追踪
   */
  async searchProducts(params: SearchParams): Promise<TaobaoProduct[]> {
    if (this.isMock) {
      return this.mockSearch(params.keyword)
    }

    // 生成带 PID 的淘宝联盟推广搜索链接
    const pid = this.pid // mm_9962389207_3393350325_116235600072
    const pidParts = pid.replace('mm_', '').split('_')
    const unionUrl = `https://uland.taobao.com/sem/tbsearch?refpid=${pidParts[0]}&keyword=${encodeURIComponent(params.keyword)}&clk1=&upsId=${pidParts[2]}`

    // 同时生成普通淘宝搜索链接作为备用
    const searchUrl = `https://s.taobao.com/search?q=${encodeURIComponent(params.keyword)}&sort=sale-desc`

    this.lastError = ''

    return [{
      itemId: `union_${Date.now()}`,
      title: `在淘宝搜索: ${params.keyword}`,
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
   * 获取联盟推广搜索链接模板（前端用 keyword 替换占位符）
   */
  getAffiliateUrlTemplate(): string | null {
    if (this.isMock || !this.pid) return null
    const pidParts = this.pid.replace('mm_', '').split('_')
    return `https://uland.taobao.com/sem/tbsearch?refpid=${pidParts[0]}&keyword=__KEYWORD__&upsId=${pidParts[2]}`
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
