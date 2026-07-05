import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { config } = require('dotenv')

const webDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(webDir, '../..')

// Shared monorepo .env (API, Supabase, etc.)
config({ path: resolve(rootDir, '.env') })
config({ path: resolve(rootDir, '.env.local'), override: true })
// apps/web/.env.local overrides for local dev (e.g. http://127.0.0.1:3847)
config({ path: resolve(webDir, '.env.local'), override: true })

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@myinventory/shared'],
  // Allow the Cloudflare tunnel host and any trycloudflare subdomains in dev
  allowedDevOrigins: [
    'higher-memorial-steering-donna.trycloudflare.com',
    '*.trycloudflare.com',
  ],
};

export default nextConfig;
