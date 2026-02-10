/**
 * 内存级频率限制器
 * 用于保护登录等敏感接口，防暴力破解
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// 每 5 分钟清理一次过期条目，防内存泄漏
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * 检查是否超出频率限制
 * @param key     限制维度（如 IP 或 email）
 * @param limit   窗口内最大请求数
 * @param windowMs 时间窗口（毫秒）
 * @returns { limited: boolean, remaining: number, retryAfterMs: number }
 */
export function checkRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000
): { limited: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, remaining: limit - 1, retryAfterMs: 0 }
  }

  entry.count++

  if (entry.count > limit) {
    const retryAfterMs = entry.resetAt - now
    return { limited: true, remaining: 0, retryAfterMs }
  }

  return { limited: false, remaining: limit - entry.count, retryAfterMs: 0 }
}
