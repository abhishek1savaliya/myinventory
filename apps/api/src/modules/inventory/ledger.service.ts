import type { PrismaTransactionClient } from '@myinventory/prisma'
import type { AdjustmentReason, TransactionType } from '@myinventory/shared'

export interface CreateLedgerEntryInput {
  type: TransactionType
  productId: string
  sku: string
  quantity: number
  userId: string
  sourceWarehouseId?: string | null
  sourceLocationId?: string | null
  destinationWarehouseId?: string | null
  destinationLocationId?: string | null
  deviceRecordId?: string | null
  reference?: string | null
  notes?: string | null
  adjustmentReason?: AdjustmentReason | null
}

/** Single write path for the immutable inventory audit ledger. */
export async function createInventoryLedgerEntry(
  tx: PrismaTransactionClient,
  input: CreateLedgerEntryInput,
) {
  return tx.inventoryTransaction.create({
    data: {
      type: input.type,
      productId: input.productId,
      sku: input.sku,
      quantity: input.quantity,
      userId: input.userId,
      sourceWarehouseId: input.sourceWarehouseId ?? null,
      sourceLocationId: input.sourceLocationId ?? null,
      destinationWarehouseId: input.destinationWarehouseId ?? null,
      destinationLocationId: input.destinationLocationId ?? null,
      deviceRecordId: input.deviceRecordId ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      adjustmentReason: input.adjustmentReason ?? null,
    },
  })
}

export function formatLedgerLog(entry: {
  id: string
  type: string
  sku: string
  quantity: number
  userId: string
  reference?: string | null
}): string {
  return `[Ledger] ${entry.type} | id=${entry.id} | sku=${entry.sku} | qty=${entry.quantity} | user=${entry.userId}${entry.reference ? ` | ref=${entry.reference}` : ''}`
}
