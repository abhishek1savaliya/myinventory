import { Redis } from '@upstash/redis'
import { env } from '../config/env.js'

export const redis = new Redis({
  url: env.upstashRedisRestUrl,
  token: env.upstashRedisRestToken,
})

export async function checkRedisConnection(): Promise<void> {
  await redis.ping()
}
