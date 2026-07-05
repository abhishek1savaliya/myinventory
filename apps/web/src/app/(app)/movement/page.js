'use client'

import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { FeaturePage } from '@/components/pages/FeaturePage'

export default function MovementRoute() {
  return (
    <FeatureGate feature={AppFeature.MOVEMENT}>
      <FeaturePage title="Stock movement" description="Move inventory between locations." />
    </FeatureGate>
  )
}
