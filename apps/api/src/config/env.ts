import { z } from 'zod'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

config({ path: resolve(__dirname, '../../../../.env') })

// If a platform provides `PORT`, prefer it and force binding to 0.0.0.0 so
// the hosting load balancer can reach the service. Load `.env` first and
// then override any local values to ensure platform behavior wins.
if (process.env.PORT) {
  process.env.API_PORT = process.env.PORT
  process.env.API_HOST = '0.0.0.0'
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3847),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SECRET_KEY: z.string().min(1, 'SUPABASE_SECRET_KEY is required'),
  SUPABASE_LOGS_BUCKET: z.string().min(1).default('api-logs'),
  SUPABASE_PRODUCTS_BUCKET: z.string().min(1).default('product-images'),
  SUPABASE_ORG_BRANDING_BUCKET: z.string().min(1).default('org-branding'),
  SUPABASE_SESSIONS_BUCKET: z.string().min(1).default('user-sessions'),
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),
  CACHE_TTL_CATALOG_SECONDS: z.coerce.number().int().min(30).default(300),
  CACHE_TTL_INVENTORY_SECONDS: z.coerce.number().int().min(15).default(60),
  CACHE_TTL_SCAN_BARCODE_SECONDS: z.coerce.number().int().min(5).default(30),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('[MyInventory API] Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  apiHost: parsed.data.API_HOST,
  apiPort: parsed.data.API_PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
  supabaseUrl: parsed.data.SUPABASE_URL,
  supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY,
  supabaseLogsBucket: parsed.data.SUPABASE_LOGS_BUCKET,
  supabaseProductsBucket: parsed.data.SUPABASE_PRODUCTS_BUCKET,
  supabaseOrgBrandingBucket: parsed.data.SUPABASE_ORG_BRANDING_BUCKET,
  supabaseSessionsBucket: parsed.data.SUPABASE_SESSIONS_BUCKET,
  upstashRedisRestUrl: parsed.data.UPSTASH_REDIS_REST_URL,
  upstashRedisRestToken: parsed.data.UPSTASH_REDIS_REST_TOKEN,
  cacheTtlCatalogSeconds: parsed.data.CACHE_TTL_CATALOG_SECONDS,
  cacheTtlInventorySeconds: parsed.data.CACHE_TTL_INVENTORY_SECONDS,
  cacheTtlScanBarcodeSeconds: parsed.data.CACHE_TTL_SCAN_BARCODE_SECONDS,
} as const
