-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "payoutDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_year_month_sequence_key" ON "PayrollRun"("year", "month", "sequence");

-- CreateIndex
CREATE INDEX "PayrollRun_year_month_idx" ON "PayrollRun"("year", "month");

-- CreateIndex
CREATE INDEX "PayrollRun_payoutDate_idx" ON "PayrollRun"("payoutDate");

-- AlterTable
ALTER TABLE "UserPayrollPayout" ADD COLUMN "runId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "UserPayrollPayout_runId_idx" ON "UserPayrollPayout"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPayrollPayout_runId_userId_key" ON "UserPayrollPayout"("runId", "userId");

-- AddForeignKey
ALTER TABLE "UserPayrollPayout" ADD CONSTRAINT "UserPayrollPayout_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
