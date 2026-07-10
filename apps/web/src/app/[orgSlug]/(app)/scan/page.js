'use client'

import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { ScanPage } from '@/components/pages/ScanPage'

export default function ScanRoute() {
  return (
    <FeatureGate feature={AppFeature.SCAN}>
      <ScanPage />
    </FeatureGate>
  )
}
