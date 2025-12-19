import 'dotenv/config'

import { prisma } from '../lib/prisma'

type MissingBindingRow = {
  id: number
  submissionOrder: number | null
}

const main = async () => {
  const updatedCount = await prisma.$executeRaw`
    UPDATE "InspectionEntry" AS ie
    SET "documentId" = s."documentId"
    FROM "Submission" AS s
    WHERE ie."documentId" IS NULL
      AND ie."submissionOrder" IS NOT NULL
      AND s."submissionNumber" = ie."submissionOrder";
  `

  const missingBindings = (await prisma.$queryRaw`
    SELECT ie.id, ie."submissionOrder"
    FROM "InspectionEntry" AS ie
    LEFT JOIN "Submission" AS s
      ON s."submissionNumber" = ie."submissionOrder"
    WHERE ie."submissionOrder" IS NOT NULL
      AND ie."documentId" IS NULL
      AND s."documentId" IS NULL;
  `) as MissingBindingRow[]

  console.log(`Updated ${updatedCount} inspection entries with submission bindings.`)
  if (missingBindings.length) {
    console.log('Missing submission bindings (no matching Submission.submissionNumber):')
    missingBindings.forEach((row) => {
      console.log(`- InspectionEntry#${row.id} submissionOrder=${row.submissionOrder}`)
    })
  } else {
    console.log('All submissionOrder values matched existing submissions.')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
