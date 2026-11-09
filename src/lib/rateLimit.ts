/**
 * Rate Limiting Service Abstraction for WeatherPulse
 *
 * Current Architecture & Limitations:
 * 1. Default: In-memory Map sliding window.
 *    - Memory limitation: When deployed to serverless environments (e.g. Vercel, AWS Lambda),
 *      each function instance maintains its own isolated memory state. In-memory counters
 *      reset across cold starts and do not synchronize across concurrent instances.
 * 2. Optional Production Distributed Backend:
 *    - Compatible with Redis or Upstash REST HTTP API if UPSTASH_REDIS_REST_URL and
 *      UPSTASH_REDIS_REST_TOKEN are set in environment variables.
 *    - Local development does not require Redis and defaults to in-memory mode seamlessly.
 */

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  backend: "memory" | "redis";
}

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

/**
 * Periodically purge expired memory entries to prevent unbounded memory growth in long-running Node processes
 */
function cleanupExpiredMemoryEntries(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.resetAt) {
      memoryStore.delete(key);
    }
  }
}

// Run cleanup every 10 minutes if running in a persistent runtime
if (typeof setInterval !== "undefined") {
  const timer = setInterval(cleanupExpiredMemoryEntries, 10 * 60 * 1000);
  if (timer.unref) timer.unref();
}

/**
 * Check rate limit for a given identifier (e.g., client IP address or user ID).
 *
 * @param identifier - Key identifier such as IP address
 * @param maxRequests - Max allowable requests in window (default: 5)
 * @param windowMs - Sliding/fixed window duration in milliseconds (default: 1 hour)
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests = 5,
  windowMs = 60 * 60 * 1000
): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // If Redis credentials are fully provided, use distributed atomic counter
  if (redisUrl && redisToken) {
    try {
      const now = Date.now();
      const windowKey = `ratelimit:${identifier}:${Math.floor(now / windowMs)}`;
      const res = await fetch(`${redisUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", windowKey],
          ["EXPIRE", windowKey, Math.ceil(windowMs / 1000)],
        ]),
      });

      if (res.ok) {
        const results = await res.json();
        const currentCount = results[0]?.result ?? 1;
        const resetAt = Math.ceil(now / windowMs) * windowMs;

        return {
          success: currentCount <= maxRequests,
          limit: maxRequests,
          remaining: Math.max(0, maxRequests - currentCount),
          resetAt,
          backend: "redis",
        };
      }
    } catch (err) {
      console.warn("[RateLimit] Distributed Redis check failed, falling back to in-memory:", err);
    }
  }

  // In-Memory Fallback
  const now = Date.now();
  const entry = memoryStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    memoryStore.set(identifier, { count: 1, resetAt });
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetAt,
      backend: "memory",
    };
  }

  if (entry.count >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetAt: entry.resetAt,
      backend: "memory",
    };
  }

  entry.count += 1;
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
    backend: "memory",
  };
}

