import type { Product } from '@prisma/client'
import type { CreateProductInput, CreateProductFromScanInput, ProductDto, ProductListQuery, UpdateProductInput } from '@myinventory/shared'
import { ProductStatus } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'
import { AppError } from '../../middleware/error-handler.js'
import { cacheGetOrSet, cacheTtl, invalidateCache, stableCacheSuffix } from '../../lib/cache.js'
import { uploadProductImageFromBase64 } from '../../lib/product-images.js'

function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    description: product.description,
    category: product.category,
    imageUrl: product.imageUrl,
    status: product.status as ProductStatus,
    minimumStockLevel: product.minimumStockLevel,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

function buildProductWhere(query: ProductListQuery) {
  const where: {
    OR?: Array<{
      sku?: { contains: string; mode: 'insensitive' }
      barcode?: { contains: string; mode: 'insensitive' }
      name?: { contains: string; mode: 'insensitive' }
    }>
    sku?: { contains: string; mode: 'insensitive' }
    barcode?: { contains: string; mode: 'insensitive' }
    status?: ProductStatus
  } = {}

  if (query.search) {
    where.OR = [
      { sku: { contains: query.search, mode: 'insensitive' } },
      { barcode: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } },
    ]
  }

  if (query.sku) {
    where.sku = { contains: query.sku, mode: 'insensitive' }
  }

  if (query.barcode) {
    where.barcode = { contains: query.barcode, mode: 'insensitive' }
  }

  if (query.status) {
    where.status = query.status
  }

  return where
}

export async function listProducts(query: ProductListQuery) {
  return cacheGetOrSet(
    'products',
    stableCacheSuffix('list', query),
    cacheTtl.catalog,
    async () => {
      const where = buildProductWhere(query)
      const skip = (query.page - 1) * query.pageSize

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.pageSize,
        }),
        prisma.product.count({ where }),
      ])

      return {
        data: products.map(toProductDto),
        total,
        page: query.page,
        pageSize: query.pageSize,
      }
    },
  )
}

export async function getProductById(id: string): Promise<ProductDto> {
  return cacheGetOrSet('products', stableCacheSuffix('id', { id }), cacheTtl.catalog, async () => {
    const product = await prisma.product.findUnique({ where: { id } })

    if (!product) {
      throw new AppError(404, 'Product not found')
    }

    return toProductDto(product)
  })
}

export async function getProductByBarcode(barcode: string): Promise<ProductDto> {
  const normalizedBarcode = barcode.trim()

  return cacheGetOrSet(
    'products',
    stableCacheSuffix('barcode', { barcode: normalizedBarcode }),
    cacheTtl.catalog,
    async () => {
      const product = await prisma.product.findUnique({
        where: { barcode: normalizedBarcode },
      })

      if (!product) {
        throw new AppError(404, 'Product not found')
      }

      return toProductDto(product)
    },
  )
}

export async function createProduct(input: CreateProductInput): Promise<ProductDto> {
  try {
    const product = await prisma.product.create({
      data: {
        sku: input.sku.trim(),
        barcode: input.barcode.trim(),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        category: input.category?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        minimumStockLevel: input.minimumStockLevel,
      },
    })

    await invalidateCache('products')
    await invalidateCache('inventory')

    return toProductDto(product)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, 'SKU or barcode already exists')
    }
    throw error
  }
}

export async function createProductFromScan(input: CreateProductFromScanInput): Promise<ProductDto> {
  const { imageBase64, ...productInput } = input
  let imageUrl: string | undefined

  if (imageBase64) {
    imageUrl = await uploadProductImageFromBase64(imageBase64)
  }

  return createProduct({
    ...productInput,
    imageUrl,
  })
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDto> {
  await getProductById(id)

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        sku: input.sku?.trim(),
        barcode: input.barcode?.trim(),
        name: input.name?.trim(),
        description: input.description === undefined ? undefined : input.description?.trim() || null,
        category: input.category === undefined ? undefined : input.category?.trim() || null,
        imageUrl: input.imageUrl === undefined ? undefined : input.imageUrl?.trim() || null,
        minimumStockLevel: input.minimumStockLevel,
      },
    })

    await invalidateCache('products')
    await invalidateCache('inventory')

    return toProductDto(product)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, 'SKU or barcode already exists')
    }
    throw error
  }
}

export async function disableProduct(id: string): Promise<ProductDto> {
  await getProductById(id)

  const product = await prisma.product.update({
    where: { id },
    data: { status: ProductStatus.DISABLED },
  })

  await invalidateCache('products')
  await invalidateCache('inventory')

  return toProductDto(product)
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}
