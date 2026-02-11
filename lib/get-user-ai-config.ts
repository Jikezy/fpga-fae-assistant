/**
 * 统一获取用户 AI 配置
 * 优先从 ai_providers 表读取活跃供应商，回退到 users 表旧字段
 */

import { getSql, ensureAiModelColumn } from './db-schema'
import { getActiveProvider } from './provider-db'

export interface UserAIConfig {
  apiKey: string
  baseURL: string
  model: string
}

export async function getUserAIConfig(userId: string): Promise<UserAIConfig | null> {
  // 1. 先查 ai_providers 表的活跃供应商
  try {
    const active = await getActiveProvider(userId)
    if (active && active.api_key && active.base_url && active.model) {
      return {
        apiKey: active.api_key,
        baseURL: active.base_url,
        model: active.model,
      }
    }
  } catch {
    // ai_providers 表可能不存在（未迁移），继续回退
  }

  // 2. 回退到 users 表旧字段
  await ensureAiModelColumn()
  const sql = getSql()
  const rows = await sql`
    SELECT anthropic_api_key, anthropic_base_url, ai_model
    FROM users WHERE id = ${userId}
  `

  if (rows.length === 0) return null

  const user = rows[0] as any
  if (!user.anthropic_api_key || !user.anthropic_base_url || !user.ai_model) {
    return null
  }

  return {
    apiKey: user.anthropic_api_key,
    baseURL: user.anthropic_base_url,
    model: user.ai_model,
  }
}
