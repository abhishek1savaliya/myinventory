'use client'

import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { WarehousesPage } from '@/components/pages/WarehousesPage'

export default function WarehousesRoute() {
  return (
    <FeatureGate feature={AppFeature.WAREHOUSES}>
      <WarehousesPage />
    </FeatureGate>
  )
}
