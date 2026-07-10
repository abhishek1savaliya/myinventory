/** Neon pooler hostnames break Prisma advisory locks — migrations need a direct connection. */

export function toDirectDatabaseUrl(url) {
  const trimmed = url.trim()
  const direct = trimmed.replace(/-pooler\./g, '.').replace(/-pooler(?=[./?]|$)/g, '')
  return appendConnectTimeout(direct)
}

function appendConnectTimeout(url) {
  if (/connect_timeout=/i.test(url)) {
    return url
  }
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}connect_timeout=30`
}

export function databaseHost(url) {
  const match = url.match(/@([^/?]+)/)
  return match?.[1] ?? 'unknown'
}

export function ensureDirectDatabaseUrl() {
  if (process.env.DIRECT_DATABASE_URL?.trim()) {
    const direct = appendConnectTimeout(process.env.DIRECT_DATABASE_URL.trim())
    process.env.DIRECT_DATABASE_URL = direct
    return direct
  }

  const pooled = process.env.DATABASE_URL?.trim()
  if (!pooled) {
    return null
  }

  const direct = toDirectDatabaseUrl(pooled)
  process.env.DIRECT_DATABASE_URL = direct
  return direct
}
