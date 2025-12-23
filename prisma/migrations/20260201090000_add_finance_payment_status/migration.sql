-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID';

-- CreateIndex
CREATE INDEX "FinanceEntry_paymentStatus_idx" ON "FinanceEntry"("paymentStatus");
