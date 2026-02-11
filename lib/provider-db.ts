/**
 * AI 供应商管理数据库操作
 */

import { getSql } from './db-schema'
import { randomBytes, createHash } from 'crypto'

// ========== 类型定义 ==========

export interface AIProvider {
  id: string
  user_id: string
  name: string
  base_url: string
  api_key: string
  model: string
  api_format: 'auto' | 'openai' | 'anthropic'
  icon: string | null
  notes: string | null
  priority: number
  is_active: boolean
  health_status: 'healthy' | 'degraded' | 'down' | 'unknown'
  consecutive_failures: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface ProxyApiKey {
  id: string
  user_id: string
  key_hash: string
  key_prefix: string
  name: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

export interface ProxyLog {
  id: string
  user_id: string
  provider_id: string | null
  request_format: string | null
  target_format: string | null
  model: string | null
  input_tokens: number
  output_tokens: number
  estimated_cost: number
  latency_ms: number
  status: string
  error_message: string | null
  provider_name: string | null
  created_at: string
}

// ========== 供应商操作 ==========

export async function createProvider(userId: string, data: {
  name: string
  base_url: string
  api_key: string
  model: string
  api_format?: string
  icon?: string
  notes?: string
}): Promise<AIProvider> {
  const sql = getSql()
  const id = randomBytes(16).toString('hex')
  const now = new Date().toISOString()

  // 获取当前最大 priority
  const maxP = await sql`
    SELECT COALESCE(MAX(priority), -1) as max_priority FROM ai_providers WHERE user_id = ${userId}
  `
  const priority = (maxP[0] as any).max_priority + 1

  await sql`
    INSERT INTO ai_providers (id, user_id, name, base_url, api_key, model, api_format, icon, notes, priority, is_active, health_status, consecutive_failures, created_at, updated_at)
    VALUES (${id}, ${userId}, ${data.name}, ${data.base_url}, ${data.api_key}, ${data.model}, ${data.api_format || 'auto'}, ${data.icon || null}, ${data.notes || null}, ${priority}, false, 'unknown', 0, ${now}, ${now})
  `

  return {
    id, user_id: userId, name: data.name, base_url: data.base_url,
    api_key: data.api_key, model: data.model,
    api_format: (data.api_format || 'auto') as any,
    icon: data.icon || null, notes: data.notes || null,
    priority, is_active: false, health_status: 'unknown',
    consecutive_failures: 0, last_used_at: null,
    created_at: now, updated_at: now,
  }
}

export async function getProviders(userId: string): Promise<AIProvider[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM ai_providers WHERE user_id = ${userId} ORDER BY priority ASC
  `
  return rows as any[]
}

export async function getProvider(providerId: string, userId: string): Promise<AIProvider | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM ai_providers WHERE id = ${providerId} AND user_id = ${userId} LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as any) : null
}

export async function getActiveProvider(userId: string): Promise<AIProvider | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM ai_providers WHERE user_id = ${userId} AND is_active = true LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as any) : null
}

export async function updateProvider(providerId: string, userId: string, data: Partial<{
  name: string
  base_url: string
  api_key: string
  model: string
  api_format: string
  icon: string
  notes: string
}>): Promise<void> {
  const sql = getSql()
  const now = new Date().toISOString()

  if (data.name !== undefined) {
    await sql`UPDATE ai_providers SET name = ${data.name}, updated_at = ${now} WHERE id = ${providerId} AND user_id = ${userId}`
  }
  if (data.base_url !== undefined) {
    await sql`UPDATE ai_providers SET base_url = ${data.base_url}, updated_at = ${now} WHERE id = ${providerId} AND user_id = ${userId}`
  }
  if (data.api_key !== undefined) {
    await sql`UPDATE ai_providers SET api_key = ${data.api_key}, updated_at = ${now} WHERE id = ${providerId} AND user_id = ${userId}`
  }
  if (data.model !== undefined) {
    await sql`UPDATE ai_providers SET model = ${data.model}, updated_at = ${now} WHERE id = ${providerId} AND user_id = ${userId}`
  }
  if (data.api_format !== undefined) {
    await sql`UPDATE ai_providers SET api_format = ${data.api_format}, updated_at = ${now} WHERE id = ${providerId} AND user_id = ${userId}`
  }
  if (data.icon !== undefined) {
    await sql`UPDATE ai_providers SET icon = ${data.icon}, updated_at = ${now} WHERE id = ${providerId} AND user_id = ${userId}`
  }
  if (data.notes !== undefined) {
    await sql`UPDATE ai_providers SET notes = ${data.notes}, updated_at = ${now} WHERE id = ${providerId} AND user_id = ${userId}`
  }
}

export async function deleteProvider(providerId: string, userId: string): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM ai_providers WHERE id = ${providerId} AND user_id = ${userId}`
}

export async function setActiveProvider(providerId: string, userId: string): Promise<void> {
  const sql = getSql()
  // 先停用所有
  await sql`UPDATE ai_providers SET is_active = false, updated_at = ${new Date().toISOString()} WHERE user_id = ${userId}`
  // 再激活指定的
  await sql`UPDATE ai_providers SET is_active = true, updated_at = ${new Date().toISOString()} WHERE id = ${providerId} AND user_id = ${userId}`
}

export async function reorderProviders(userId: string, orderedIds: string[]): Promise<void> {
  const sql = getSql()
  const now = new Date().toISOString()
  for (let i = 0; i < orderedIds.length; i++) {
    await sql`UPDATE ai_providers SET priority = ${i}, updated_at = ${now} WHERE id = ${orderedIds[i]} AND user_id = ${userId}`
  }
}

export async function updateHealthStatus(providerId: string, status: string, consecutiveFailures: number): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE ai_providers SET health_status = ${status}, consecutive_failures = ${consecutiveFailures}, updated_at = ${new Date().toISOString()}
    WHERE id = ${providerId}
  `
}

export async function getProvidersForFailover(userId: string): Promise<AIProvider[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM ai_providers
    WHERE user_id = ${userId} AND health_status != 'down'
    ORDER BY is_active DESC, priority ASC
  `
  return rows as any[]
}

export async function markProviderUsed(providerId: string): Promise<void> {
  const sql = getSql()
  await sql`UPDATE ai_providers SET last_used_at = ${new Date().toISOString()} WHERE id = ${providerId}`
}

// ========== 代理 Key 操作 ==========

export async function createProxyKey(userId: string, name: string = 'Default'): Promise<{ key: string; record: ProxyApiKey }> {
  const sql = getSql()
  const id = randomBytes(16).toString('hex')
  const rawKey = `fpga-sk-${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.substring(0, 12)
  const now = new Date().toISOString()

  await sql`
    INSERT INTO proxy_api_keys (id, user_id, key_hash, key_prefix, name, is_active, created_at)
    VALUES (${id}, ${userId}, ${keyHash}, ${keyPrefix}, ${name}, true, ${now})
  `

  return {
    key: rawKey,
    record: {
      id, user_id: userId, key_hash: keyHash, key_prefix: keyPrefix,
      name, is_active: true, last_used_at: null, created_at: now,
    },
  }
}

export async function validateProxyKey(rawKey: string): Promise<{ userId: string; keyId: string } | null> {
  const sql = getSql()
  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const rows = await sql`
    SELECT id, user_id FROM proxy_api_keys WHERE key_hash = ${keyHash} AND is_active = true LIMIT 1
  `

  if (rows.length === 0) return null

  const record = rows[0] as any
  // 更新最后使用时间
  await sql`UPDATE proxy_api_keys SET last_used_at = ${new Date().toISOString()} WHERE id = ${record.id}`

  return { userId: record.user_id, keyId: record.id }
}

export async function getProxyKeys(userId: string): Promise<ProxyApiKey[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM proxy_api_keys WHERE user_id = ${userId} ORDER BY created_at DESC
  `
  return rows as any[]
}

export async function deleteProxyKey(keyId: string, userId: string): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM proxy_api_keys WHERE id = ${keyId} AND user_id = ${userId}`
}

// ========== 日志操作 ==========

export async function logProxyRequest(data: {
  userId: string
  providerId?: string
  requestFormat?: string
  targetFormat?: string
  model?: string
  inputTokens?: number
  outputTokens?: number
  estimatedCost?: number
  latencyMs?: number
  status: string
  errorMessage?: string
  providerName?: string
}): Promise<void> {
  const sql = getSql()
  const id = randomBytes(16).toString('hex')

  await sql`
    INSERT INTO proxy_logs (id, user_id, provider_id, request_format, target_format, model, input_tokens, output_tokens, estimated_cost, latency_ms, status, error_message, provider_name, created_at)
    VALUES (${id}, ${data.userId}, ${data.providerId || null}, ${data.requestFormat || null}, ${data.targetFormat || null}, ${data.model || null}, ${data.inputTokens || 0}, ${data.outputTokens || 0}, ${data.estimatedCost || 0}, ${data.latencyMs || 0}, ${data.status}, ${data.errorMessage || null}, ${data.providerName || null}, ${new Date().toISOString()})
  `
}

export async function getProxyStats(userId: string, range: string = '7d'): Promise<{
  summary: { totalRequests: number; totalTokens: number; estimatedCost: number; avgLatency: number }
  byProvider: any[]
  byModel: any[]
  recentLogs: ProxyLog[]
}> {
  const sql = getSql()

  let since: string
  const now = new Date()
  if (range === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  } else if (range === '30d') {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  } else {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }

  const summaryRows = await sql`
    SELECT
      COUNT(*)::int as total_requests,
      COALESCE(SUM(input_tokens + output_tokens), 0)::int as total_tokens,
      COALESCE(SUM(estimated_cost), 0)::float as estimated_cost,
      COALESCE(AVG(latency_ms), 0)::int as avg_latency
    FROM proxy_logs
    WHERE user_id = ${userId} AND created_at >= ${since}
  `

  const byProvider = await sql`
    SELECT provider_name, COUNT(*)::int as requests, COALESCE(SUM(input_tokens + output_tokens), 0)::int as tokens, COALESCE(SUM(estimated_cost), 0)::float as cost
    FROM proxy_logs
    WHERE user_id = ${userId} AND created_at >= ${since} AND provider_name IS NOT NULL
    GROUP BY provider_name ORDER BY requests DESC
  `

  const byModel = await sql`
    SELECT model, COUNT(*)::int as requests, COALESCE(SUM(input_tokens + output_tokens), 0)::int as tokens, COALESCE(SUM(estimated_cost), 0)::float as cost
    FROM proxy_logs
    WHERE user_id = ${userId} AND created_at >= ${since} AND model IS NOT NULL
    GROUP BY model ORDER BY requests DESC
  `

  const recentLogs = await sql`
    SELECT * FROM proxy_logs
    WHERE user_id = ${userId} AND created_at >= ${since}
    ORDER BY created_at DESC LIMIT 50
  `

  const s = summaryRows[0] as any

  return {
    summary: {
      totalRequests: s.total_requests,
      totalTokens: s.total_tokens,
      estimatedCost: s.estimated_cost,
      avgLatency: s.avg_latency,
    },
    byProvider: byProvider as any[],
    byModel: byModel as any[],
    recentLogs: recentLogs as any[],
  }
}
