import { Prisma } from '@prisma/client'

const ExactDecimal = Prisma.Decimal.clone({ precision: 80 })

export const signedBillDifference = (signed: string | null, ledger: string | null): string | null =>
  signed === null || ledger === null ? null : new ExactDecimal(signed).minus(ledger).toFixed()

export const sumSignedBillAmounts = (values: string[]): string | null =>
  values.length ? values.reduce((sum, value) => sum.plus(value), new ExactDecimal(0)).toFixed() : null
