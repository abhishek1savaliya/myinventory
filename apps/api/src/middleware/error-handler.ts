import type { Request, Response, NextFunction } from 'express'
import type { ApiError } from '@myinventory/shared'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: ApiError = {
      error: err.name,
      message: err.message,
      details: err.details,
    }
    res.status(err.statusCode).json(body)
    return
  }

  console.error('[API Error]', err)
  const body: ApiError = {
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
  }
  res.status(500).json(body)
}

export function notFoundHandler(_req: Request, res: Response): void {
  const body: ApiError = {
    error: 'NotFound',
    message: 'The requested resource was not found',
  }
  res.status(404).json(body)
}
