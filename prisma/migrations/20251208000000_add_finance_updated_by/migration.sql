-- Add updatedBy to finance entry for audit of edits
ALTER TABLE "FinanceEntry"
ADD COLUMN     "updatedBy" INTEGER;

ALTER TABLE "FinanceEntry"
ADD CONSTRAINT "FinanceEntry_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FinanceEntry_updatedBy_idx" ON "FinanceEntry"("updatedBy");
