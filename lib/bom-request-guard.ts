import { checkRateLimit } from './rate-limit'

type ParseSlot = {
  waitMs: number
  inFlight: number
  release: () => void
}

type ParseRateLimitResult = {
  limited: boolean
  retryAfterMs: number
  message: string
}

const RATE_WINDOW_MS = 60 * 1000
const USER_LIMIT_PER_WINDOW = normalizePositiveInt(process.env.BOM_PARSE_USER_LIMIT_PER_MIN, 10)
const IP_LIMIT_PER_WINDOW = normalizePositiveInt(process.env.BOM_PARSE_IP_LIMIT_PER_MIN, 80)
const MAX_IN_FLIGHT = normalizePositiveInt(process.env.BOM_PARSE_MAX_IN_FLIGHT, 6)
const MAX_QUEUE_WAIT_MS = normalizePositiveInt(process.env.BOM_PARSE_MAX_QUEUE_WAIT_MS, 6000)
const WAIT_STEP_MS = 50

let inFlight = 0

function normalizePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.floor(parsed)
  return rounded > 0 ? rounded : fallback
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function checkBomParseRateLimit(userId: string, ip: string): ParseRateLimitResult {
  const userResult = checkRateLimit(
    `bom-parse:user:${userId}`,
    USER_LIMIT_PER_WINDOW,
    RATE_WINDOW_MS
  )

  if (userResult.limited) {
    return {
      limited: true,
      retryAfterMs: userResult.retryAfterMs,
      message: `\u89e3\u6790\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41\uff0c\u8bf7 ${Math.max(1, Math.ceil(userResult.retryAfterMs / 1000))} \u79d2\u540e\u91cd\u8bd5`,
    }
  }

  const ipKey = ip || 'unknown'
  const ipResult = checkRateLimit(
    `bom-parse:ip:${ipKey}`,
    IP_LIMIT_PER_WINDOW,
    RATE_WINDOW_MS
  )

  if (ipResult.limited) {
    return {
      limited: true,
      retryAfterMs: ipResult.retryAfterMs,
      message: `\u5f53\u524d\u89e3\u6790\u6d41\u91cf\u8f83\u9ad8\uff0c\u8bf7 ${Math.max(1, Math.ceil(ipResult.retryAfterMs / 1000))} \u79d2\u540e\u518d\u8bd5`,
    }
  }

  return { limited: false, retryAfterMs: 0, message: '' }
}

export async function acquireBomParseSlot(): Promise<ParseSlot | null> {
  const start = Date.now()

  while (inFlight >= MAX_IN_FLIGHT) {
    if (Date.now() - start >= MAX_QUEUE_WAIT_MS) {
      return null
    }
    await sleep(WAIT_STEP_MS)
  }

  inFlight += 1
  let released = false

  return {
    waitMs: Date.now() - start,
    inFlight,
    release: () => {
      if (released) return
      released = true
      inFlight = Math.max(0, inFlight - 1)
    },
  }
}

export function getBomParseQueueState() {
  return {
    inFlight,
    maxInFlight: MAX_IN_FLIGHT,
    maxQueueWaitMs: MAX_QUEUE_WAIT_MS,
  }
}
