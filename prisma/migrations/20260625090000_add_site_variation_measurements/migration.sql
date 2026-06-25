-- CreateEnum
CREATE TYPE "SiteVariationMeasurementStatus" AS ENUM ('PENDING_CONFIRMATION', 'READY_TO_MEASURE', 'MEASURED', 'ARCHIVED', 'VOID');

-- CreateEnum
CREATE TYPE "SiteVariationMeasurementType" AS ENUM ('ADDITION', 'INCREASE', 'DECREASE', 'LOCATION_ADJUSTMENT', 'SPEC_ADJUSTMENT', 'FIELD_SUBSTITUTION', 'DESIGN_OMISSION', 'OTHER');

-- CreateEnum
CREATE TYPE "SiteVariationMeasurementReason" AS ENUM ('SITE_CONDITION', 'SUPERVISION_REQUIREMENT', 'OWNER_REQUIREMENT', 'DESIGN_ERROR', 'CONSTRUCTION_OPTIMIZATION', 'OTHER');

-- CreateTable
CREATE TABLE "SiteVariationMeasurement" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "roadSectionId" INTEGER,
    "mainRoadSectionId" INTEGER,
    "boqItemId" INTEGER,
    "measurementDetailId" INTEGER,
    "status" "SiteVariationMeasurementStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "changeType" "SiteVariationMeasurementType" NOT NULL DEFAULT 'OTHER',
    "reason" "SiteVariationMeasurementReason",
    "structureName" TEXT,
    "phaseName" TEXT,
    "spec" TEXT,
    "unit" TEXT,
    "startPk" TEXT,
    "endPk" TEXT,
    "side" "IntervalSide",
    "designDescription" TEXT,
    "fieldDescription" TEXT,
    "differenceDescription" TEXT,
    "designQuantity" DECIMAL(18,2),
    "actualQuantity" DECIMAL(18,2),
    "deltaQuantity" DECIMAL(18,2),
    "proposedQuantity" DECIMAL(18,2),
    "unitPrice" DECIMAL(18,2),
    "estimatedAmount" DECIMAL(18,2),
    "occurredAt" TIMESTAMP(3),
    "discoveredByText" TEXT,
    "measurementPeriod" TIMESTAMP(3),
    "measuredAt" TIMESTAMP(3),
    "attachmentComplete" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "archivedById" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteVariationMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteVariationMeasurement_projectId_status_idx" ON "SiteVariationMeasurement"("projectId", "status");

-- CreateIndex
CREATE INDEX "SiteVariationMeasurement_projectId_occurredAt_idx" ON "SiteVariationMeasurement"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "SiteVariationMeasurement_roadSectionId_idx" ON "SiteVariationMeasurement"("roadSectionId");

-- CreateIndex
CREATE INDEX "SiteVariationMeasurement_mainRoadSectionId_idx" ON "SiteVariationMeasurement"("mainRoadSectionId");

-- CreateIndex
CREATE INDEX "SiteVariationMeasurement_boqItemId_idx" ON "SiteVariationMeasurement"("boqItemId");

-- CreateIndex
CREATE INDEX "SiteVariationMeasurement_measurementDetailId_idx" ON "SiteVariationMeasurement"("measurementDetailId");

-- CreateIndex
CREATE INDEX "SiteVariationMeasurement_status_idx" ON "SiteVariationMeasurement"("status");

-- CreateIndex
CREATE INDEX "SiteVariationMeasurement_changeType_idx" ON "SiteVariationMeasurement"("changeType");

-- AddForeignKey
ALTER TABLE "SiteVariationMeasurement" ADD CONSTRAINT "SiteVariationMeasurement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationMeasurement" ADD CONSTRAINT "SiteVariationMeasurement_roadSectionId_fkey" FOREIGN KEY ("roadSectionId") REFERENCES "RoadSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationMeasurement" ADD CONSTRAINT "SiteVariationMeasurement_mainRoadSectionId_fkey" FOREIGN KEY ("mainRoadSectionId") REFERENCES "RoadSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationMeasurement" ADD CONSTRAINT "SiteVariationMeasurement_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationMeasurement" ADD CONSTRAINT "SiteVariationMeasurement_measurementDetailId_fkey" FOREIGN KEY ("measurementDetailId") REFERENCES "BoqMeasurementDetail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationMeasurement" ADD CONSTRAINT "SiteVariationMeasurement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationMeasurement" ADD CONSTRAINT "SiteVariationMeasurement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationMeasurement" ADD CONSTRAINT "SiteVariationMeasurement_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
