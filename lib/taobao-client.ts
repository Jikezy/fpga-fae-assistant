/**
 * 淘宝联盟（淘宝客）API 客户端
 * 未配置 API Key 时自动使用 mock 数据
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
      return this.mockSearch(params.keyword, params.pageSize || 10)
    }

    try {
      const result = await this.callApi('taobao.tbk.dg.material.optional', {
        adzone_id: this.pid.split('_').pop() || '',
        q: params.keyword,
        sort: params.sort || 'total_sales_des',
        page_size: String(params.pageSize || 20),
        page_no: String(params.pageNo || 1),
        has_coupon: params.hasCoupon ? 'true' : 'false',
      })

      const items = result?.tbk_dg_material_optional_response?.result_list?.map_data || []

      return items.map((item: any) => ({
        itemId: item.item_id || item.num_iid,
        title: item.title,
        price: item.zk_final_price,
        originalPrice: item.reserve_price,
        sales: String(item.volume || 0),
        shopName: item.shop_title,
        shopScore: item.shop_dsr || '4.8',
        imageUrl: item.pict_url,
        buyUrl: item.coupon_share_url || item.url,
        taoToken: '',
        couponInfo: item.coupon_info || '',
        couponAmount: item.coupon_amount || '0',
        commissionRate: item.commission_rate || '0',
        platform: item.user_type === 1 ? 'tmall' : 'taobao',
      }))
    } catch (error) {
      console.error('淘宝 API 调用失败，降级到 mock:', error)
      return this.mockSearch(params.keyword, params.pageSize || 10)
    }
  }

  /**
   * 生成淘口令
   */
  async createTaoToken(url: string, title: string): Promise<string> {
    if (this.isMock) {
      return `￥mock${Math.random().toString(36).substring(2, 8)}￥`
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
   * Mock 搜索数据 - 电子元器件
   */
  private mockSearch(keyword: string, count: number): TaobaoProduct[] {
    const kw = keyword.toLowerCase()

    // 基于关键词生成合理的 mock 数据
    const mockDb: Record<string, Array<{ title: string; price: string; origPrice: string; sales: string; shop: string }>> = {
      stm32: [
        { title: 'STM32F103C8T6 最小系统板 ARM 核心板 STM32开发板', price: '8.50', origPrice: '12.00', sales: '3000+', shop: '深圳芯片直销店' },
        { title: 'STM32F103C8T6 芯片 LQFP48 单片机 全新原装', price: '5.80', origPrice: '8.00', sales: '5000+', shop: '优信电子' },
        { title: 'STM32F103C8T6 开发板 带ST-Link下载器 送教程', price: '25.00', origPrice: '35.00', sales: '800+', shop: '正点原子旗舰店' },
      ],
      '电容': [
        { title: '0805贴片电容 100nF 104 50V X7R 全系列', price: '0.01', origPrice: '0.03', sales: '50000+', shop: '华创电子元件' },
        { title: '贴片电容包 0805 常用37种各20只共740只', price: '12.80', origPrice: '18.00', sales: '2000+', shop: '深圳元器件批发' },
        { title: '直插电解电容 10uF-1000uF 常用12种共120只', price: '6.50', origPrice: '9.00', sales: '3500+', shop: '电子之家' },
      ],
      '电阻': [
        { title: '0805贴片电阻 10K 1% 全系列 100只', price: '1.50', origPrice: '3.00', sales: '20000+', shop: '华创电子元件' },
        { title: '贴片电阻包 0805 常用55种各50只共2750只', price: '15.80', origPrice: '22.00', sales: '5000+', shop: '深圳元器件批发' },
        { title: '金属膜电阻包 1/4W 常用30种各20只共600只', price: '8.80', origPrice: '12.00', sales: '8000+', shop: '电子之家' },
      ],
      '稳压': [
        { title: 'AMS1117-3.3V 稳压模块 LDO 降压板 SOT-223', price: '0.80', origPrice: '1.50', sales: '10000+', shop: '优信电子' },
        { title: 'LM7805 三端稳压器 5V稳压模块 TO-220', price: '0.50', origPrice: '1.00', sales: '15000+', shop: '华创电子元件' },
        { title: 'DC-DC降压模块 LM2596 可调稳压 送散热片', price: '3.50', origPrice: '5.00', sales: '6000+', shop: '深圳模块专营' },
      ],
      '杜邦线': [
        { title: '杜邦线 母对母 20cm 40P彩色排线', price: '2.50', origPrice: '4.00', sales: '30000+', shop: '电子之家' },
        { title: '杜邦线套装 公对公+公对母+母对母 各40根', price: '6.80', origPrice: '9.00', sales: '12000+', shop: '优信电子' },
        { title: '杜邦线 母对母 10/20/30cm 可选长度', price: '1.80', origPrice: '3.00', sales: '25000+', shop: '深圳线材批发' },
      ],
      '排针': [
        { title: '2.54mm排针 单排直针 1x40P 镀金 10根', price: '1.50', origPrice: '3.00', sales: '40000+', shop: '华创电子元件' },
        { title: '排针排母套装 单排双排 2.54mm 常用合集', price: '5.80', origPrice: '8.00', sales: '8000+', shop: '深圳元器件批发' },
      ],
      'led': [
        { title: 'LED发光二极管 5mm 红绿黄蓝白 各20只共100只', price: '3.50', origPrice: '5.00', sales: '20000+', shop: '电子之家' },
        { title: '0805贴片LED 红色 100只', price: '2.00', origPrice: '3.50', sales: '15000+', shop: '华创电子元件' },
      ],
    }

    // 匹配关键词
    let results: typeof mockDb['stm32'] = []
    for (const [key, items] of Object.entries(mockDb)) {
      if (kw.includes(key) || key.includes(kw)) {
        results = items
        break
      }
    }

    // 如果没有匹配到，生成通用结果
    if (results.length === 0) {
      results = [
        { title: `${keyword} 电子元器件 全新原装正品`, price: '5.00', origPrice: '8.00', sales: '1000+', shop: '优信电子' },
        { title: `${keyword} 模块 开发板配件`, price: '12.00', origPrice: '18.00', sales: '500+', shop: '深圳芯片直销店' },
        { title: `${keyword} 配件包 常用套装`, price: '8.50', origPrice: '12.00', sales: '800+', shop: '电子之家' },
      ]
    }

    return results.slice(0, count).map((item, i) => ({
      itemId: `mock_${Date.now()}_${i}`,
      title: item.title,
      price: item.price,
      originalPrice: item.origPrice,
      sales: item.sales,
      shopName: item.shop,
      shopScore: (4.7 + Math.random() * 0.3).toFixed(1),
      imageUrl: '',
      buyUrl: `https://s.taobao.com/search?q=${encodeURIComponent(keyword)}&sort=sale-desc`,
      taoToken: '',
      couponInfo: '',
      couponAmount: '0',
      commissionRate: '0',
      platform: 'taobao' as const,
    }))
  }
}

// 导出单例
export const taobaoClient = new TaobaoClient()
