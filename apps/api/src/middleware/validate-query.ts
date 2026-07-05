import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'
import { AppError } from './error-handler.js'

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query)

    if (!result.success) {
      throw new AppError(400, 'Validation failed', result.error.flatten())
    }

    req.query = result.data as Request['query']
    next()
  }
}
