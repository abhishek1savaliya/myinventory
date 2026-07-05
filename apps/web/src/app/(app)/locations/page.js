'use client'

import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { LocationsPage } from '@/components/pages/LocationsPage'

export default function LocationsRoute() {
  return (
    <FeatureGate feature={AppFeature.LOCATIONS}>
      <LocationsPage />
    </FeatureGate>
  )
}
