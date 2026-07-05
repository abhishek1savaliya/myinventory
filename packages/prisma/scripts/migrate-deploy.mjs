import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureDirectDatabaseUrl } from './ensure-direct-database-url.mjs'
import { spawnSync } from 'node:child_process'

const directUrl = ensureDirectDatabaseUrl()

if (!process.env.DATABASE_URL?.trim()) {
  console.error('[prisma] DATABASE_URL is required for migrate deploy')
  process.exit(1)
}

if (!directUrl) {
  console.error('[prisma] Could not resolve DIRECT_DATABASE_URL from DATABASE_URL')
  process.exit(1)
}

const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

console.log('[prisma] Running migrate deploy via direct database connection')

const result = spawnSync('prisma', ['migrate', 'deploy', '--schema', './schema.prisma'], {
  cwd: prismaDir,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
