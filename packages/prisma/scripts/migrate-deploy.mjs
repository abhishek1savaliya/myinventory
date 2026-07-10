import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  databaseHost,
  ensureDirectDatabaseUrl,
} from './ensure-direct-database-url.mjs'

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 15_000

const directUrl = ensureDirectDatabaseUrl()

if (!process.env.DATABASE_URL?.trim()) {
  console.error('[prisma] DATABASE_URL is required for migrate deploy')
  process.exit(1)
}

if (!directUrl) {
  console.error('[prisma] Could not resolve DIRECT_DATABASE_URL from DATABASE_URL')
  process.exit(1)
}

const directHost = databaseHost(directUrl)
if (directHost.includes('-pooler')) {
  console.error(
    '[prisma] DIRECT_DATABASE_URL must use a direct Neon hostname (no "-pooler").',
    'Set DIRECT_DATABASE_URL in Render to the non-pooler connection string.',
  )
  process.exit(1)
}

const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

console.log(`[prisma] Running migrate deploy via direct connection (${directHost})`)

function runMigrateDeploy() {
  const migrateEnv = {
    ...process.env,
    DATABASE_URL: directUrl,
    DIRECT_DATABASE_URL: directUrl,
  }

  return spawnSync('prisma', ['migrate', 'deploy', '--schema', './schema.prisma'], {
    cwd: prismaDir,
    stdio: 'inherit',
    env: migrateEnv,
    shell: process.platform === 'win32',
  })
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  if (attempt > 1) {
    console.log(
      `[prisma] Retrying migrate deploy (attempt ${attempt}/${MAX_ATTEMPTS}) after advisory lock timeout...`,
    )
  }

  const result = runMigrateDeploy()
  if (result.status === 0) {
    process.exit(0)
  }

  if (attempt < MAX_ATTEMPTS) {
    console.warn(
      `[prisma] migrate deploy failed; waiting ${RETRY_DELAY_MS / 1000}s before retry`,
    )
    await sleep(RETRY_DELAY_MS)
  }
}

console.error(
  '[prisma] migrate deploy failed after all retries.',
  'If the error was P1002 (advisory lock), check Render for concurrent deploys',
  'or clear a stale lock in Neon: SELECT * FROM pg_locks WHERE locktype = \'advisory\';',
)
process.exit(1)
