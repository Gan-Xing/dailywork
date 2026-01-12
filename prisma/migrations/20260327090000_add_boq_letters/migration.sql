-- CreateTable
CREATE TABLE "Letter" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "boqItemId" INTEGER,
    "letterNumber" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "senderOrg" TEXT,
    "recipientOrg" TEXT,
    "issuedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Letter_documentId_key" ON "Letter"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Letter_projectId_letterNumber_key" ON "Letter"("projectId", "letterNumber");

-- CreateIndex
CREATE INDEX "Letter_boqItemId_idx" ON "Letter"("boqItemId");

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_boqItemId_fkey"
  FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
