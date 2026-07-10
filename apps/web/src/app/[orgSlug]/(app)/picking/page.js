'use client'

import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { FeaturePage } from '@/components/pages/FeaturePage'

export default function PickingRoute() {
  return (
    <FeatureGate feature={AppFeature.PICKING}>
      <FeaturePage title="Picking" description="Pick stock for outbound orders." />
    </FeatureGate>
  )
}
