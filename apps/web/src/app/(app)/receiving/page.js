'use client'

import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { FeaturePage } from '@/components/pages/FeaturePage'

export default function ReceivingRoute() {
  return (
    <FeatureGate feature={AppFeature.RECEIVING}>
      <FeaturePage title="Receiving" description="Receive stock into warehouse locations." />
    </FeatureGate>
  )
}
