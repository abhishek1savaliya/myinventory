import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { PrismaClient, TransactionType, UserRole } from '@prisma/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

config({ path: resolve(__dirname, '../../.env') })

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Admin123!', 12)

  const organization = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {
      name: 'MyInventory Demo',
      tradingName: 'MyInventory Demo',
      ownerName: 'System Administrator',
      email: 'admin@inventoryos.local',
      contactNumber: '',
    },
    create: {
      id: 'org_default_seed',
      orgCode: 'DEM10001',
      slug: 'demo',
      name: 'MyInventory Demo',
      tradingName: 'MyInventory Demo',
      ownerName: 'System Administrator',
      email: 'admin@inventoryos.local',
      contactNumber: '',
    },
  })

  const admin = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: 'admin@inventoryos.local',
      },
    },
    update: {
      name: 'System Administrator',
      passwordHash,
      role: UserRole.ADMIN,
    },
    create: {
      organizationId: organization.id,
      name: 'System Administrator',
      email: 'admin@inventoryos.local',
      passwordHash,
      role: UserRole.ADMIN,
    },
  })

  const warehouse = await prisma.warehouse.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'MEL-01',
      },
    },
    update: {
      name: 'Melbourne Distribution Centre',
      address: 'Melbourne, VIC, Australia',
    },
    create: {
      organizationId: organization.id,
      code: 'MEL-01',
      name: 'Melbourne Distribution Centre',
      address: 'Melbourne, VIC, Australia',
    },
  })

  const location = await prisma.location.upsert({
    where: {
      warehouseId_code: {
        warehouseId: warehouse.id,
        code: 'A-01-02',
      },
    },
    update: {
      zone: 'A',
      aisle: '01',
      rack: '01',
      shelf: '02',
      bin: '02',
    },
    create: {
      warehouseId: warehouse.id,
      code: 'A-01-02',
      zone: 'A',
      aisle: '01',
      rack: '01',
      shelf: '02',
      bin: '02',
    },
  })

  const product = await prisma.product.upsert({
    where: {
      organizationId_sku: {
        organizationId: organization.id,
        sku: 'HH-100293',
      },
    },
    update: {
      barcode: '9348291029291',
      name: 'Gold Necklace',
      description: 'Premium gold necklace',
      category: 'Jewellery',
      minimumStockLevel: 10,
    },
    create: {
      organizationId: organization.id,
      sku: 'HH-100293',
      barcode: '9348291029291',
      name: 'Gold Necklace',
      description: 'Premium gold necklace',
      category: 'Jewellery',
      minimumStockLevel: 10,
    },
  })

  const inventory = await prisma.inventory.upsert({
    where: {
      productId_warehouseId_locationId: {
        productId: product.id,
        warehouseId: warehouse.id,
        locationId: location.id,
      },
    },
    update: {
      quantity: 50,
    },
    create: {
      productId: product.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      quantity: 50,
    },
  })

  const existingSeedTransaction = await prisma.inventoryTransaction.findFirst({
    where: {
      productId: product.id,
      type: TransactionType.STOCK_RECEIVED,
      reference: 'SEED-INITIAL',
    },
  })

  if (!existingSeedTransaction) {
    await prisma.inventoryTransaction.create({
      data: {
        type: TransactionType.STOCK_RECEIVED,
        productId: product.id,
        sku: product.sku,
        quantity: 50,
        destinationWarehouseId: warehouse.id,
        destinationLocationId: location.id,
        userId: admin.id,
        reference: 'SEED-INITIAL',
        notes: 'Initial seed inventory for development',
      },
    })
  }

  const windowsDevice = await prisma.device.upsert({
    where: { deviceId: 'WINDOWS-DEV-001' },
    update: {
      name: 'Development Windows Desktop',
      platform: 'win32',
      userId: admin.id,
      lastSeenAt: new Date(),
    },
    create: {
      deviceId: 'WINDOWS-DEV-001',
      name: 'Development Windows Desktop',
      platform: 'win32',
      userId: admin.id,
      lastSeenAt: new Date(),
    },
  })

  console.log('[MyInventory Seed] Completed successfully')
  console.log(`  Organization: ${organization.name} (${organization.orgCode})`)
  console.log(`  URL slug:     /${organization.slug}/dashboard`)
  console.log(`  Admin:        ${admin.email}`)
  console.log(`  Warehouse:    ${warehouse.code} — ${warehouse.name}`)
  console.log(`  Location:     ${location.code}`)
  console.log(`  Product:      ${product.sku} (${product.barcode}) — ${product.name}`)
  console.log(`  Inventory:    ${inventory.quantity} units`)
  console.log(`  Device:       ${windowsDevice.deviceId}`)
}

main()
  .catch((error: unknown) => {
    console.error('[MyInventory Seed] Failed')
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error(error)
    }
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
