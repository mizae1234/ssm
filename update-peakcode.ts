import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log("Updating peakCode = partNo for all PartMaster records using raw query...")
  const result = await prisma.$executeRaw`UPDATE "PartMaster" SET "peakCode" = "partNo"`
  console.log(`Completed successfully. Rows affected: ${result}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
