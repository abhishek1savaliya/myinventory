import { Router } from 'express'
import { transactionListQuerySchema } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateQuery } from '../../middleware/validate-query.js'
import { authenticate } from '../../middleware/auth.js'
import { listTransactions, getTransactionById } from './transactions.service.js'

export const transactionsRouter = Router()

transactionsRouter.get(
  '/transactions',
  asyncHandler(authenticate),
  validateQuery(transactionListQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await listTransactions(req.query as never)
    res.json(result)
  }),
)

transactionsRouter.get(
  '/transactions/:id',
  asyncHandler(authenticate),
  asyncHandler(async (req, res) => {
    const transaction = await getTransactionById(req.params.id)
    res.json({ data: transaction })
  }),
)
