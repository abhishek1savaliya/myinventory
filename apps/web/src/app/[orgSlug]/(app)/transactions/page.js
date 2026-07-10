'use client'

import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { TransactionsPage } from '@/components/pages/TransactionsPage'

export default function TransactionsRoute() {
  return (
    <FeatureGate feature={AppFeature.TRANSACTIONS}>
      <TransactionsPage />
    </FeatureGate>
  )
}
