-- CreateEnum
CREATE TYPE "SiteVariationRawRecordStatus" AS ENUM ('PENDING_REVIEW', 'IN_REVIEW', 'CONFIRMED', 'CONVERTED', 'DUPLICATE', 'VOID');

-- CreateTable
CREATE TABLE "SiteVariationRawRecord" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3),
    "projectId" INTEGER,
    "roadSectionId" INTEGER,
    "status" "SiteVariationRawRecordStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "extractedJson" JSONB,
    "reviewNote" TEXT,
    "convertedVariationId" INTEGER,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteVariationRawRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteVariationRawRecord_status_idx" ON "SiteVariationRawRecord"("status");

-- CreateIndex
CREATE INDEX "SiteVariationRawRecord_recordDate_idx" ON "SiteVariationRawRecord"("recordDate");

-- CreateIndex
CREATE INDEX "SiteVariationRawRecord_projectId_idx" ON "SiteVariationRawRecord"("projectId");

-- CreateIndex
CREATE INDEX "SiteVariationRawRecord_roadSectionId_idx" ON "SiteVariationRawRecord"("roadSectionId");

-- CreateIndex
CREATE INDEX "SiteVariationRawRecord_convertedVariationId_idx" ON "SiteVariationRawRecord"("convertedVariationId");

-- CreateIndex
CREATE INDEX "SiteVariationRawRecord_createdAt_idx" ON "SiteVariationRawRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "SiteVariationRawRecord" ADD CONSTRAINT "SiteVariationRawRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationRawRecord" ADD CONSTRAINT "SiteVariationRawRecord_roadSectionId_fkey" FOREIGN KEY ("roadSectionId") REFERENCES "RoadSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationRawRecord" ADD CONSTRAINT "SiteVariationRawRecord_convertedVariationId_fkey" FOREIGN KEY ("convertedVariationId") REFERENCES "SiteVariationMeasurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationRawRecord" ADD CONSTRAINT "SiteVariationRawRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVariationRawRecord" ADD CONSTRAINT "SiteVariationRawRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
