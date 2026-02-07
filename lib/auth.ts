import { getSql } from './db-schema'
import { randomBytes, createHash } from 'crypto'

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

/**
 * 简单的密码哈希（使用SHA-256）
 * 注意：生产环境建议使用 bcrypt
 */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

/**
 * 验证密码
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
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
  const passwordHash = hashPassword(password)

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
