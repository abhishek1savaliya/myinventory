import type { ProductStatus, WarehouseStatus, LocationStatus } from './index.js'

export interface ProductImageDto {
  id: string
  url: string
  sortOrder: number
}

export interface ProductDto {
  id: string
  sku: string
  barcode: string
  name: string
  description: string | null
  category: string | null
  imageUrl: string | null
  images: ProductImageDto[]
  status: ProductStatus
  minimumStockLevel: number
  createdAt: string
  updatedAt: string
}

export interface WarehouseDto {
  id: string
  code: string
  name: string
  address: string | null
  status: WarehouseStatus
  createdAt: string
  updatedAt: string
}

export interface LocationDto {
  id: string
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  code: string
  zone: string | null
  aisle: string | null
  rack: string | null
  shelf: string | null
  bin: string | null
  status: LocationStatus
  createdAt: string
  updatedAt: string
}
