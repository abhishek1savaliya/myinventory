import { Router } from 'express'
import { organizationSignupSchema } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import {
  getOrganizationPublicProfile,
  signupOrganization,
} from './organizations.service.js'

export const organizationsRouter = Router()

organizationsRouter.post(
  '/organizations/signup',
  validateBody(organizationSignupSchema),
  asyncHandler(async (req, res) => {
    const result = await signupOrganization(req.body)
    res.status(201).json(result)
  }),
)

organizationsRouter.get(
  '/organizations/by-slug/:slug',
  asyncHandler(async (req, res) => {
    const profile = await getOrganizationPublicProfile(req.params.slug)
    res.json({ data: profile })
  }),
)
