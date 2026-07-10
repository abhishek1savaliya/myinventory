import { Router } from 'express'
import { transactionListQuerySchema } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateQuery } from '../../middleware/validate-query.js'
import { authenticate } from '../../middleware/auth.js'
import { requireOrgId } from '../../lib/org-context.js'
import { listTransactions, getTransactionById } from './transactions.service.js'

export const transactionsRouter = Router()

transactionsRouter.get(
  '/transactions',
  asyncHandler(authenticate),
  validateQuery(transactionListQuerySchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const result = await listTransactions(orgId, req.query as never)
    res.json(result)
  }),
)

transactionsRouter.get(
  '/transactions/:id',
  asyncHandler(authenticate),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const transaction = await getTransactionById(orgId, req.params.id)
    res.json({ data: transaction })
  }),
)
