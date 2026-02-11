import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getSql } from '@/lib/db-schema'

export const runtime = 'nodejs'

/**
 * 数据库迁移接口（仅管理员可访问）
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return authResult.error
  }

  // 验证是否为管理员
  const sql = getSql()
  const userResult = await sql`
    SELECT role FROM users WHERE id = ${authResult.user.id}
  `

  if (userResult.length === 0 || userResult[0].role !== 'admin') {
    return NextResponse.json(
      { error: '仅管理员可执行数据库迁移' },
      { status: 403 }
    )
  }

  try {
    // 1. 添加新字段到 users 表（如果不存在）
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT,
      ADD COLUMN IF NOT EXISTS anthropic_base_url TEXT
    `

    // 2. 添加 user_id 字段到 documents 表（如果不存在）
    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE
    `

    // 3. 添加 user_id 字段到 embeddings 表（如果不存在）
    await sql`
      ALTER TABLE embeddings
      ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE
    `

    // 4. 添加 ai_model 字段（BYOK 改造）
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_model TEXT
    `

    // 5. 创建索引以提高查询性能
    await sql`
      CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON embeddings(user_id)
    `

    // 6. AI 供应商管理表
    await sql`
      CREATE TABLE IF NOT EXISTS ai_providers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        api_format TEXT NOT NULL DEFAULT 'auto',
        icon TEXT,
        notes TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT false,
        health_status TEXT NOT NULL DEFAULT 'unknown',
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 7. 代理 API Key 表
    await sql`
      CREATE TABLE IF NOT EXISTS proxy_api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_hash TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'Default',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 8. 代理请求日志表
    await sql`
      CREATE TABLE IF NOT EXISTS proxy_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider_id TEXT,
        request_format TEXT,
        target_format TEXT,
        model TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        estimated_cost DECIMAL DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'success',
        error_message TEXT,
        provider_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 9. AI 供应商相关索引
    await sql`CREATE INDEX IF NOT EXISTS idx_ai_providers_user_id ON ai_providers(user_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_ai_providers_active ON ai_providers(user_id, is_active)`
    await sql`CREATE INDEX IF NOT EXISTS idx_proxy_api_keys_user_id ON proxy_api_keys(user_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_proxy_api_keys_hash ON proxy_api_keys(key_hash)`
    await sql`CREATE INDEX IF NOT EXISTS idx_proxy_logs_user_id ON proxy_logs(user_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_proxy_logs_created ON proxy_logs(user_id, created_at)`

    return NextResponse.json({
      success: true,
      message: '数据库迁移成功：已添加用户API配置字段、文档用户隔离字段、AI供应商管理表',
    })
  } catch (error) {
    console.error('数据库迁移失败:', error)
    return NextResponse.json(
      {
        error: '数据库迁移失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
