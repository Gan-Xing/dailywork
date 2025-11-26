-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "handlerId" INTEGER;

-- CreateIndex
CREATE INDEX "FinanceEntry_handlerId_idx" ON "FinanceEntry"("handlerId");

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_handlerId_fkey" FOREIGN KEY ("handlerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
