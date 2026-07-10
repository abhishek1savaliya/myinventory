'use client'

import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { SettingsPage } from '@/components/pages/SettingsPage'

export default function SettingsRoute() {
  return (
    <FeatureGate feature={AppFeature.SETTINGS}>
      <SettingsPage />
    </FeatureGate>
  )
}
