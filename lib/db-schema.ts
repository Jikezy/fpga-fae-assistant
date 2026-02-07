import { neon } from '@neondatabase/serverless'

// 获取数据库连接字符串（Vercel会自动注入POSTGRES_URL）
const getDatabaseUrl = () => {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL
  if (!url) {
    throw new Error('数据库连接字符串未配置')
  }
  return url
}

/**
 * 初始化数据库表结构
 */
export async function initializeDatabase() {
  const sql = neon(getDatabaseUrl())

  try {
    // 创建用户表
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        anthropic_api_key TEXT,
        anthropic_base_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 创建会话表
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 创建文档表
    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        page INTEGER,
        title TEXT,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 创建向量嵌入表（简化版，存储文本向量的JSON）
    await sql`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
        embedding_vector TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 创建索引以提高查询性能
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON embeddings(document_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON embeddings(user_id)
    `

    console.log('数据库表初始化成功')
    return { success: true }
  } catch (error) {
    console.error('数据库初始化失败:', error)
    throw error
  }
}

/**
 * 获取SQL客户端
 */
export function getSql() {
  return neon(getDatabaseUrl())
}
