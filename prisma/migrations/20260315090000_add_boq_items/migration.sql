-- CreateEnum
CREATE TYPE "BoqSheetType" AS ENUM ('CONTRACT', 'ACTUAL');

-- CreateEnum
CREATE TYPE "BoqItemTone" AS ENUM ('SECTION', 'SUBSECTION', 'ITEM', 'TOTAL');

-- CreateTable
CREATE TABLE "BoqItem" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "sheetType" "BoqSheetType" NOT NULL DEFAULT 'CONTRACT',
    "contractItemId" INTEGER,
    "code" TEXT NOT NULL,
    "designationZh" TEXT NOT NULL,
    "designationFr" TEXT NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL(18,2),
    "quantity" DECIMAL(18,2),
    "totalPrice" DECIMAL(18,2),
    "tone" "BoqItemTone" NOT NULL DEFAULT 'ITEM',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqMeasurement" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "boqItemId" INTEGER NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "unitPrice" DECIMAL(18,2),
    "amount" DECIMAL(18,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoqMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoqItem_projectId_sheetType_sortOrder_idx" ON "BoqItem"("projectId", "sheetType", "sortOrder");

-- CreateIndex
CREATE INDEX "BoqItem_projectId_sheetType_code_idx" ON "BoqItem"("projectId", "sheetType", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BoqMeasurement_boqItemId_period_key" ON "BoqMeasurement"("boqItemId", "period");

-- CreateIndex
CREATE INDEX "BoqMeasurement_projectId_period_idx" ON "BoqMeasurement"("projectId", "period");

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqMeasurement" ADD CONSTRAINT "BoqMeasurement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqMeasurement" ADD CONSTRAINT "BoqMeasurement_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
