-- CreateEnum
CREATE TYPE "FinanceLedgerCaseStatus" AS ENUM ('IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "FinanceLedgerStage" AS ENUM (
  'SITE_SIGNED',
  'HQ_BILL_RECEIVED',
  'BE_CONFIRMED',
  'BE_DELIVERED',
  'HQ_INVOICE_RECEIVED',
  'CHEQUE_ISSUED',
  'CHEQUE_RECEIVED'
);

-- CreateTable
CREATE TABLE "FinanceLedgerCase" (
  "id" SERIAL NOT NULL,
  "sequence" INTEGER NOT NULL,
  "projectId" INTEGER NOT NULL,
  "periodIndex" INTEGER NOT NULL,
  "sectionId" INTEGER,
  "status" "FinanceLedgerCaseStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "currentStage" "FinanceLedgerStage",
  "enteredCurrentStageAt" TIMESTAMP(3),
  "accountAmount" DECIMAL(18, 2),
  "invoiceAmount" DECIMAL(18, 2),
  "advanceAmount" DECIMAL(18, 2),
  "chequeAmount" DECIMAL(18, 2),
  "invoiceNumber" TEXT,
  "receiptChequeNumber" TEXT,
  "remark" TEXT,
  "ptoSiteSignedAt" TIMESTAMP(3),
  "ptoHqBillReceivedAt" TIMESTAMP(3),
  "ptoBeConfirmedAt" TIMESTAMP(3),
  "ptoBeDeliveredAt" TIMESTAMP(3),
  "ptoHqInvoiceReceivedAt" TIMESTAMP(3),
  "chequeIssuedAt" TIMESTAMP(3),
  "chequeReceivedAt" TIMESTAMP(3),
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "deletedBy" INTEGER,
  "updatedBy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" INTEGER,
  CONSTRAINT "FinanceLedgerCase_pkey" PRIMARY KEY ("id")
);

-- CreateSequence
CREATE SEQUENCE "FinanceLedgerCase_sequence_seq";

-- BindSequence
ALTER SEQUENCE "FinanceLedgerCase_sequence_seq" OWNED BY "FinanceLedgerCase"."sequence";
ALTER TABLE ONLY "FinanceLedgerCase"
ALTER COLUMN "sequence" SET DEFAULT nextval('"FinanceLedgerCase_sequence_seq"'::regclass);

-- CreateTable
CREATE TABLE "FinanceLedgerEvent" (
  "id" SERIAL NOT NULL,
  "caseId" INTEGER NOT NULL,
  "stage" "FinanceLedgerStage" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payloadJson" JSONB,
  "note" TEXT,
  "updatedBy" INTEGER,
  "createdBy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceLedgerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLedgerSla" (
  "id" SERIAL NOT NULL,
  "projectId" INTEGER,
  "fromStage" "FinanceLedgerStage" NOT NULL,
  "toStage" "FinanceLedgerStage" NOT NULL,
  "maxDays" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceLedgerSla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceLedgerCase_sequence_key" ON "FinanceLedgerCase"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceLedgerCase_projectId_periodIndex_key" ON "FinanceLedgerCase"("projectId", "periodIndex");

-- CreateIndex
CREATE INDEX "FinanceLedgerCase_projectId_status_currentStage_idx" ON "FinanceLedgerCase"("projectId", "status", "currentStage");

-- CreateIndex
CREATE INDEX "FinanceLedgerCase_sectionId_idx" ON "FinanceLedgerCase"("sectionId");

-- CreateIndex
CREATE INDEX "FinanceLedgerCase_isDeleted_idx" ON "FinanceLedgerCase"("isDeleted");

-- CreateIndex
CREATE INDEX "FinanceLedgerCase_updatedAt_idx" ON "FinanceLedgerCase"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceLedgerEvent_caseId_stage_key" ON "FinanceLedgerEvent"("caseId", "stage");

-- CreateIndex
CREATE INDEX "FinanceLedgerEvent_stage_occurredAt_idx" ON "FinanceLedgerEvent"("stage", "occurredAt");

-- CreateIndex
CREATE INDEX "FinanceLedgerEvent_caseId_occurredAt_idx" ON "FinanceLedgerEvent"("caseId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinanceLedgerSla_projectId_fromStage_toStage_active_idx" ON "FinanceLedgerSla"("projectId", "fromStage", "toStage", "active");

-- AddForeignKey
ALTER TABLE "FinanceLedgerCase"
ADD CONSTRAINT "FinanceLedgerCase_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedgerCase"
ADD CONSTRAINT "FinanceLedgerCase_sectionId_fkey"
FOREIGN KEY ("sectionId") REFERENCES "RoadSection"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedgerCase"
ADD CONSTRAINT "FinanceLedgerCase_deletedBy_fkey"
FOREIGN KEY ("deletedBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedgerCase"
ADD CONSTRAINT "FinanceLedgerCase_updatedBy_fkey"
FOREIGN KEY ("updatedBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedgerCase"
ADD CONSTRAINT "FinanceLedgerCase_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedgerEvent"
ADD CONSTRAINT "FinanceLedgerEvent_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "FinanceLedgerCase"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedgerEvent"
ADD CONSTRAINT "FinanceLedgerEvent_updatedBy_fkey"
FOREIGN KEY ("updatedBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedgerEvent"
ADD CONSTRAINT "FinanceLedgerEvent_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedgerSla"
ADD CONSTRAINT "FinanceLedgerSla_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
