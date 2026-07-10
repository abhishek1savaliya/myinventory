'use client'

import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { ProductsPage } from '@/components/pages/ProductsPage'

export default function ProductsRoute() {
  return (
    <FeatureGate feature={AppFeature.PRODUCTS}>
      <ProductsPage />
    </FeatureGate>
  )
}
