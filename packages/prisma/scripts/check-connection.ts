import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDatabaseConnection, disconnectDatabase } from '../src/client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

config({ path: resolve(__dirname, '../../../.env') })

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('[MyInventory DB] DATABASE_URL is not set in .env')
    process.exit(1)
  }

  await checkDatabaseConnection()
  console.log('[MyInventory DB] Connection successful')
}

main()
  .catch((error: unknown) => {
    console.error('[MyInventory DB] Connection failed')
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error(error)
    }
    process.exit(1)
  })
  .finally(async () => {
    await disconnectDatabase()
  })
