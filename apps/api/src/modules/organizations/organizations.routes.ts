import { Router } from 'express'
import { organizationBrandingUpdateSchema, organizationSignupSchema } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js'
import { requireOrgId } from '../../lib/org-context.js'
import {
  getOrganizationPublicProfile,
  searchOrganizations,
  signupOrganization,
  updateOrganizationBranding,
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
  '/organizations/search',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    const results = await searchOrganizations(q)
    res.json({ data: results })
  }),
)

organizationsRouter.get(
  '/organizations/by-slug/:slug',
  asyncHandler(async (req, res) => {
    const profile = await getOrganizationPublicProfile(req.params.slug)
    res.json({ data: profile })
  }),
)

organizationsRouter.patch(
  '/organizations/branding',
  asyncHandler(authenticate),
  validateBody(organizationBrandingUpdateSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const { user } = req as AuthenticatedRequest
    const branding = await updateOrganizationBranding(orgId, user.email, req.body)
    res.json({ data: branding })
  }),
)
