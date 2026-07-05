import { Router } from 'express'
import { checkDatabaseConnection } from '@myinventory/prisma'

export const healthRouter = Router()

healthRouter.get('/health', async (_req, res) => {
  try {
    await checkDatabaseConnection()

    res.json({
      status: 'ok',
      service: 'myinventory-api',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch {
    res.status(503).json({
      status: 'degraded',
      service: 'myinventory-api',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    })
  }
})
