CREATE TYPE "ReceivedDocumentLedgerStatus" AS ENUM ('RECEIVED', 'PENDING_COMPLETION', 'VOID');

CREATE TABLE "ReceivedDocumentLedger" (
  "id" SERIAL NOT NULL,
  "category" TEXT NOT NULL,
  "projectId" INTEGER NOT NULL,
  "roadSectionId" INTEGER,
  "structureName" TEXT,
  "sizeSpec" TEXT,
  "versionTag" TEXT,
  "documentName" TEXT NOT NULL,
  "documentCode" TEXT,
  "coverageScope" TEXT,
  "sourceOrg" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "receivedById" INTEGER,
  "receivedByText" TEXT,
  "status" "ReceivedDocumentLedgerStatus" NOT NULL DEFAULT 'RECEIVED',
  "remark" TEXT,
  "createdById" INTEGER,
  "updatedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReceivedDocumentLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReceivedDocumentLedger_projectId_receivedAt_idx"
  ON "ReceivedDocumentLedger" ("projectId", "receivedAt");

CREATE INDEX "ReceivedDocumentLedger_category_projectId_receivedAt_idx"
  ON "ReceivedDocumentLedger" ("category", "projectId", "receivedAt");

CREATE INDEX "ReceivedDocumentLedger_roadSectionId_idx"
  ON "ReceivedDocumentLedger" ("roadSectionId");

CREATE INDEX "ReceivedDocumentLedger_status_idx"
  ON "ReceivedDocumentLedger" ("status");

CREATE INDEX "ReceivedDocumentLedger_versionTag_idx"
  ON "ReceivedDocumentLedger" ("versionTag");

ALTER TABLE "ReceivedDocumentLedger"
  ADD CONSTRAINT "ReceivedDocumentLedger_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReceivedDocumentLedger"
  ADD CONSTRAINT "ReceivedDocumentLedger_roadSectionId_fkey"
  FOREIGN KEY ("roadSectionId") REFERENCES "RoadSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReceivedDocumentLedger"
  ADD CONSTRAINT "ReceivedDocumentLedger_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReceivedDocumentLedger"
  ADD CONSTRAINT "ReceivedDocumentLedger_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReceivedDocumentLedger"
  ADD CONSTRAINT "ReceivedDocumentLedger_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
