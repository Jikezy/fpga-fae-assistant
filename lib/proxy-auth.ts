/**
 * 代理 API Key 认证
 */

import { validateProxyKey } from './provider-db'

/**
 * 从请求中提取并验证代理 Key
 * 支持 Authorization: Bearer fpga-sk-xxx 和 x-api-key: fpga-sk-xxx
 */
export async function authenticateProxy(req: Request): Promise<{ userId: string; keyId: string } | null> {
  // 从 Authorization header 提取
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer fpga-sk-')) {
    const key = authHeader.slice(7) // "Bearer " = 7 chars
    return validateProxyKey(key)
  }

  // 从 x-api-key header 提取
  const xApiKey = req.headers.get('x-api-key')
  if (xApiKey?.startsWith('fpga-sk-')) {
    return validateProxyKey(xApiKey)
  }

  return null
}
