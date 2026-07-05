'use client'

import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { InventoryPage } from '@/components/pages/InventoryPage'

export default function InventoryRoute() {
  return (
    <FeatureGate feature={AppFeature.INVENTORY}>
      <InventoryPage />
    </FeatureGate>
  )
}
