import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

function createPrismaClient() {
  const base = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  })

  return base.$extends({
    query: {
      inventoryTransaction: {
        async update() {
          throw new Error('Inventory transactions are immutable and cannot be updated')
        },
        async updateMany() {
          throw new Error('Inventory transactions are immutable and cannot be updated')
        },
        async delete() {
          throw new Error('Inventory transactions are immutable and cannot be deleted')
        },
        async deleteMany() {
          throw new Error('Inventory transactions are immutable and cannot be deleted')
        },
        async upsert() {
          throw new Error('Inventory transactions are immutable and cannot be upserted')
        },
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

export type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0]

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}
