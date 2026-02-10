import { getSql } from './db-schema'
import { randomBytes, createHash } from 'crypto'
import bcrypt from 'bcryptjs'

export interface User {
  id: string
  email: string
  role: 'admin' | 'user'
  created_at: Date
}

export interface Session {
  id: string
  user_id: string
  token: string
  expires_at: Date
  created_at: Date
}

const BCRYPT_ROUNDS = 12

/**
 * 密码哈希（bcrypt，加盐，cost=12）
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/**
 * 验证密码（兼容旧 SHA-256 哈希，验证通过后自动升级为 bcrypt）
 */
export async function verifyPassword(password: string, hash: string, userId?: string): Promise<boolean> {
  // 新格式: bcrypt（以 $2a$ 或 $2b$ 开头）
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return bcrypt.compare(password, hash)
  }

  // 旧格式: SHA-256（64位十六进制）— 兼容迁移
  const sha256Hash = createHash('sha256').update(password).digest('hex')
  if (sha256Hash === hash) {
    // 验证通过，自动升级为 bcrypt
    if (userId) {
      try {
        const newHash = await hashPassword(password)
        const sql = getSql()
        await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}`
      } catch (e) {
        console.error('密码哈希升级失败:', e)
      }
    }
    return true
  }

  return false
}

/**
 * 生成随机token
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * 创建用户
 */
export async function createUser(email: string, password: string, role: 'admin' | 'user' = 'user'): Promise<User> {
  const sql = getSql()
  const id = randomBytes(16).toString('hex')
  const passwordHash = await hashPassword(password)

  await sql`
    INSERT INTO users (id, email, password_hash, role)
    VALUES (${id}, ${email}, ${passwordHash}, ${role})
  `

  return {
    id,
    email,
    role,
    created_at: new Date(),
  }
}

/**
 * 通过邮箱查找用户
 */
export async function findUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, email, password_hash, role, created_at
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `

  if (rows.length === 0) return null

  const row = rows[0] as any
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    created_at: new Date(row.created_at),
  }
}

/**
 * 创建会话
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const sql = getSql()
  const id = randomBytes(16).toString('hex')
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天

  await sql`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (${id}, ${userId}, ${token}, ${expiresAt})
  `

  return { token, expiresAt }
}

/**
 * 验证会话token
 */
export async function validateSession(token: string): Promise<User | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT u.id, u.email, u.role, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ${token}
    AND s.expires_at > NOW()
    LIMIT 1
  `

  if (rows.length === 0) return null

  const row = rows[0] as any
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    created_at: new Date(row.created_at),
  }
}

/**
 * 删除会话（登出）
 */
export async function deleteSession(token: string): Promise<void> {
  const sql = getSql()
  await sql`
    DELETE FROM sessions
    WHERE token = ${token}
  `
}

/**
 * 清理过期会话
 */
export async function cleanExpiredSessions(): Promise<void> {
  const sql = getSql()
  await sql`
    DELETE FROM sessions
    WHERE expires_at < NOW()
  `
}
