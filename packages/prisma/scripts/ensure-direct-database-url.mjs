/** Neon pooler hostnames break Prisma advisory locks — migrations need a direct connection. */
export function ensureDirectDatabaseUrl() {
  if (process.env.DIRECT_DATABASE_URL?.trim()) {
    return process.env.DIRECT_DATABASE_URL.trim()
  }

  const pooled = process.env.DATABASE_URL?.trim()
  if (!pooled) {
    return null
  }

  const direct = pooled.replace('-pooler.', '.').replace('-pooler', '')
  process.env.DIRECT_DATABASE_URL = direct
  return direct
}
