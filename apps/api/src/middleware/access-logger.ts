import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth.js'
import { recordAccessLog } from '../modules/access-logs/access-logs.service.js'

function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for']

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null
  }

  return req.socket.remoteAddress ?? null
}

function getUserAgent(req: Request): string | null {
  const agent = req.headers['user-agent']
  return typeof agent === 'string' ? agent.slice(0, 512) : null
}

/** Persists API requests to Supabase Storage (date-wise files, non-blocking). */
export function apiAccessLogger(req: Request, res: Response, next: NextFunction): void {
  if (!req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/api/health')) {
    next()
    return
  }

  const startedAt = Date.now()

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    const authReq = req as AuthenticatedRequest

    void recordAccessLog({
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: authReq.user?.sub ?? null,
      userEmail: authReq.user?.email ?? null,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    }).catch((error: unknown) => {
      console.error('[MyInventory API] Failed to persist access log')
      if (error instanceof Error) {
        console.error(error.message)
      }
    })
  })

  next()
}
