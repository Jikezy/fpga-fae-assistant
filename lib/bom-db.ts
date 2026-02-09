/**
 * BOM 模块数据库操作
 */

import { getSql } from './db-schema'
import { randomBytes } from 'crypto'

// ========== 项目操作 ==========

export interface BomProject {
  id: string
  user_id: string
  name: string
  source_text: string | null
  status: string
  total_estimated_price: number | null
  created_at: string
  updated_at: string
  item_count?: number
}

export async function createProject(userId: string, name: string, sourceText?: string): Promise<BomProject> {
  const sql = getSql()
  const id = randomBytes(16).toString('hex')
  const now = new Date().toISOString()

  await sql`
    INSERT INTO bom_projects (id, user_id, name, source_text, status, created_at, updated_at)
    VALUES (${id}, ${userId}, ${name}, ${sourceText || null}, 'draft', ${now}, ${now})
  `

  return {
    id, user_id: userId, name, source_text: sourceText || null,
    status: 'draft', total_estimated_price: null, created_at: now, updated_at: now,
  }
}

export async function getProjects(userId: string): Promise<BomProject[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT p.*,
           (SELECT COUNT(*) FROM bom_items WHERE project_id = p.id) as item_count
    FROM bom_projects p
    WHERE p.user_id = ${userId}
    ORDER BY p.created_at DESC
  `
  return rows as any[]
}

export async function getProject(projectId: string, userId: string): Promise<BomProject | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT p.*,
           (SELECT COUNT(*) FROM bom_items WHERE project_id = p.id) as item_count
    FROM bom_projects p
    WHERE p.id = ${projectId} AND p.user_id = ${userId}
    LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as any) : null
}

export async function updateProject(projectId: string, userId: string, data: Partial<BomProject>): Promise<void> {
  const sql = getSql()
  const now = new Date().toISOString()

  if (data.name !== undefined) {
    await sql`UPDATE bom_projects SET name = ${data.name}, updated_at = ${now} WHERE id = ${projectId} AND user_id = ${userId}`
  }
  if (data.status !== undefined) {
    await sql`UPDATE bom_projects SET status = ${data.status}, updated_at = ${now} WHERE id = ${projectId} AND user_id = ${userId}`
  }
  if (data.total_estimated_price !== undefined) {
    await sql`UPDATE bom_projects SET total_estimated_price = ${data.total_estimated_price}, updated_at = ${now} WHERE id = ${projectId} AND user_id = ${userId}`
  }
}

export async function deleteProject(projectId: string, userId: string): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM bom_projects WHERE id = ${projectId} AND user_id = ${userId}`
}

// ========== 元器件明细操作 ==========

export interface BomItemRecord {
  id: string
  project_id: string
  raw_input: string
  parsed_name: string | null
  parsed_spec: string | null
  search_keyword: string | null
  quantity: number
  status: string
  best_price: number | null
  best_source: string | null
  buy_url: string | null
  tao_token: string | null
  search_results: any | null
  created_at: string
}

export async function addItems(projectId: string, items: Array<{
  rawInput: string
  parsedName: string
  parsedSpec: string
  searchKeyword: string
  quantity: number
}>): Promise<BomItemRecord[]> {
  const sql = getSql()
  const results: BomItemRecord[] = []

  for (const item of items) {
    const id = randomBytes(16).toString('hex')
    const now = new Date().toISOString()

    await sql`
      INSERT INTO bom_items (id, project_id, raw_input, parsed_name, parsed_spec, search_keyword, quantity, status, created_at)
      VALUES (${id}, ${projectId}, ${item.rawInput}, ${item.parsedName}, ${item.parsedSpec}, ${item.searchKeyword}, ${item.quantity}, 'pending', ${now})
    `

    results.push({
      id, project_id: projectId, raw_input: item.rawInput,
      parsed_name: item.parsedName, parsed_spec: item.parsedSpec,
      search_keyword: item.searchKeyword, quantity: item.quantity,
      status: 'pending', best_price: null, best_source: null,
      buy_url: null, tao_token: null, search_results: null, created_at: now,
    })
  }

  return results
}

export async function getItems(projectId: string): Promise<BomItemRecord[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM bom_items
    WHERE project_id = ${projectId}
    ORDER BY created_at ASC
  `
  return rows as any[]
}

export async function updateItem(itemId: string, data: {
  searchResults?: any
  bestPrice?: number
  bestSource?: string
  buyUrl?: string
  taoToken?: string
  status?: string
}): Promise<void> {
  const sql = getSql()

  if (data.searchResults !== undefined) {
    await sql`UPDATE bom_items SET search_results = ${JSON.stringify(data.searchResults)} WHERE id = ${itemId}`
  }
  if (data.bestPrice !== undefined) {
    await sql`UPDATE bom_items SET best_price = ${data.bestPrice}, best_source = ${data.bestSource || 'taobao'}, buy_url = ${data.buyUrl || null}, tao_token = ${data.taoToken || null} WHERE id = ${itemId}`
  }
  if (data.status !== undefined) {
    await sql`UPDATE bom_items SET status = ${data.status} WHERE id = ${itemId}`
  }
}

export async function deleteItem(itemId: string, projectId: string): Promise<void> {
  const sql = getSql()
  await sql`DELETE FROM bom_items WHERE id = ${itemId} AND project_id = ${projectId}`
}

// ========== 缓存操作 ==========

export async function getCachedSearch(keyword: string, platform: string = 'taobao'): Promise<any | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT results FROM price_cache
    WHERE keyword = ${keyword} AND platform = ${platform} AND expires_at > NOW()
    LIMIT 1
  `
  if (rows.length > 0) {
    const result = rows[0] as any
    return typeof result.results === 'string' ? JSON.parse(result.results) : result.results
  }
  return null
}

export async function setCachedSearch(keyword: string, results: any, platform: string = 'taobao'): Promise<void> {
  const sql = getSql()
  const id = randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时缓存

  // 先删旧的
  await sql`DELETE FROM price_cache WHERE keyword = ${keyword} AND platform = ${platform}`

  await sql`
    INSERT INTO price_cache (id, keyword, platform, results, expires_at)
    VALUES (${id}, ${keyword}, ${platform}, ${JSON.stringify(results)}, ${expiresAt})
  `
}
