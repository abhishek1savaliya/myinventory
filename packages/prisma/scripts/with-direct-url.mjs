import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureDirectDatabaseUrl } from './ensure-direct-database-url.mjs'

const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('[prisma] Usage: node with-direct-url.mjs <prisma-command> [...args]')
  process.exit(1)
}

ensureDirectDatabaseUrl()

const result = spawnSync('prisma', args, {
  cwd: prismaDir,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
