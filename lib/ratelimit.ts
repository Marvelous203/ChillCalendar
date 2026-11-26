import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, MemoryBucket>();
const limiters = new Map<string, Ratelimit>();

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

export async function checkRateLimit(
  bucketKey: string,
  limit: number,
  windowSeconds: number
): Promise<{ ok: boolean; remaining: number }> {
  const redis = getRedis();
  if (redis) {
    const cacheKey = `${limit}:${windowSeconds}`;
    let rl = limiters.get(cacheKey);
    if (!rl) {
      rl = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
        prefix: 'cwm_rl',
      });
      limiters.set(cacheKey, rl);
    }
    const res = await rl.limit(bucketKey);
    return { ok: res.success, remaining: res.remaining };
  }

  // Fallback in-memory cho môi trường dev/test khi chưa cấu hình Upstash
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = memoryBuckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (existing.count >= limit) {
    return { ok: false, remaining: 0 };
  }
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}
