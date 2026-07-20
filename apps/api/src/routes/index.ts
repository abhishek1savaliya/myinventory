import { Router } from 'express'
import { healthRouter } from '../modules/health/health.routes.js'
import { authRouter } from '../modules/auth/auth.routes.js'
import { usersRouter } from '../modules/users/users.routes.js'
import { productsRouter } from '../modules/products/products.routes.js'
import { warehousesRouter } from '../modules/warehouses/warehouses.routes.js'
import { locationsRouter } from '../modules/locations/locations.routes.js'
import { inventoryRouter } from '../modules/inventory/inventory.routes.js'
import { transactionsRouter } from '../modules/transactions/transactions.routes.js'
import { organizationsRouter } from '../modules/organizations/organizations.routes.js'
import { chatRouter } from '../modules/chat/chat.routes.js'
import { systemAdminRouter } from '../modules/system-admin/system-admin.routes.js'
export const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use(organizationsRouter)
apiRouter.use('/system-admin', systemAdminRouter)
apiRouter.use(authRouter)
apiRouter.use(usersRouter)
apiRouter.use(productsRouter)
apiRouter.use(warehousesRouter)
apiRouter.use(locationsRouter)
apiRouter.use(inventoryRouter)
apiRouter.use(transactionsRouter)
apiRouter.use(chatRouter)
