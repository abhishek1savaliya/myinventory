import express from 'express'
import cors from 'cors'
import compression from 'compression'
import { checkDatabaseConnection, disconnectDatabase } from '@myinventory/prisma'
import { env } from './config/env.js'
import { apiRouter } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { apiAccessLogger } from './middleware/access-logger.js'
import {
  ensureAccessLogBucket,
  flushAllAccessLogs,
} from './modules/access-logs/access-logs.service.js'
import { ensureSessionBucket } from './lib/session-storage.js'
import { ensureProductImagesBucket } from './lib/product-images.js'
import { ensureOrgBrandingBucket } from './lib/org-branding.js'
import { ensureProfilePhotosBucket } from './lib/profile-photos.js'
import { ensureChatAttachmentsBucket } from './lib/chat-attachments.js'
import { checkRedisConnection } from './lib/redis.js'
import { initChatSocket } from './modules/chat/chat.socket.js'

const app = express()

app.set('trust proxy', 1)
app.use(cors({ origin: true, credentials: true }))
app.use(compression())
app.use(express.json({ limit: '5mb' }))
app.use(apiAccessLogger)

app.use('/api', apiRouter)

app.use(notFoundHandler)
app.use(errorHandler)

async function startServer(): Promise<void> {
  try {
    await Promise.all([
      checkDatabaseConnection(),
      ensureAccessLogBucket(),
      ensureSessionBucket(),
      ensureProductImagesBucket(),
      ensureOrgBrandingBucket(),
      ensureProfilePhotosBucket(),
      ensureChatAttachmentsBucket(),
      checkRedisConnection(),
    ])
    console.log('[MyInventory API] Database connection verified')
    console.log('[MyInventory API] Supabase access-log storage ready')
    console.log('[MyInventory API] Session storage ready')
    console.log('[MyInventory API] Supabase product-images storage ready')
    console.log('[MyInventory API] Supabase org-branding storage ready')
    console.log('[MyInventory API] Supabase profile-photos storage ready')
    console.log('[MyInventory API] Supabase chat-attachments storage ready')
    console.log('[MyInventory API] Redis cache connected')
  } catch (error) {
    console.error('[MyInventory API] Startup checks failed')
    if (error instanceof Error) {
      console.error(error.message)
    }
    process.exit(1)
  }

  const runtimePort = process.env.PORT ? Number(process.env.PORT) : env.apiPort
  const runtimeHost = process.env.API_HOST ?? process.env.HOST ?? env.apiHost

  if (env.nodeEnv !== 'production') {
    console.log('[MyInventory API] runtime env:', {
      PORT: process.env.PORT,
      API_HOST: process.env.API_HOST,
      HOST: process.env.HOST,
      env_apiHost: env.apiHost,
      env_apiPort: env.apiPort,
    })
  }

  const server = app.listen(runtimePort, runtimeHost, () => {
    console.log(`[MyInventory API] listening on http://${runtimeHost}:${runtimePort}`)
  })

  initChatSocket(server)
  console.log('[MyInventory API] Socket.IO chat ready')

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[MyInventory API] Port ${env.apiPort} is already in use. Stop the other process or change API_PORT in .env.`,
      )
      process.exit(1)
    }

    throw err
  })

  const shutdown = async (signal: string) => {
    console.log(`[MyInventory API] ${signal} received, shutting down`)
    server.close()
    try {
      await flushAllAccessLogs()
    } catch (error) {
      console.error('[MyInventory API] Failed to flush access logs on shutdown')
      if (error instanceof Error) {
        console.error(error.message)
      }
    }
    await disconnectDatabase()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

void startServer()

export { app }
