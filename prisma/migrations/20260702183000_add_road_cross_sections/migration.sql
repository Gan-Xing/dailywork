-- CreateEnum
CREATE TYPE "RoadCrossSectionStatus" AS ENUM ('APPROVED', 'ASSUMED_FROM_REFERENCE', 'NEEDS_CONFIRMATION', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "RoadCrossSection" (
    "id" SERIAL NOT NULL,
    "roadId" INTEGER NOT NULL,
    "startPk" DOUBLE PRECISION NOT NULL,
    "endPk" DOUBLE PRECISION NOT NULL,
    "profileCode" TEXT NOT NULL,
    "carriagewayWidthM" DECIMAL(10,2) NOT NULL,
    "leftShoulderWidthM" DECIMAL(10,2),
    "rightShoulderWidthM" DECIMAL(10,2),
    "totalWidthM" DECIMAL(10,2) NOT NULL,
    "status" "RoadCrossSectionStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "sourceDocumentId" INTEGER,
    "sourcePage" TEXT,
    "sourceVersion" TEXT,
    "referenceRoadId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadCrossSection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RoadCrossSection_pk_range_check" CHECK ("endPk" >= "startPk"),
    CONSTRAINT "RoadCrossSection_width_check" CHECK ("carriagewayWidthM" >= 0 AND "totalWidthM" >= 0),
    CONSTRAINT "RoadCrossSection_shoulders_check" CHECK (
        ("leftShoulderWidthM" IS NULL OR "leftShoulderWidthM" >= 0)
        AND ("rightShoulderWidthM" IS NULL OR "rightShoulderWidthM" >= 0)
    )
);

-- CreateIndex
CREATE INDEX "RoadCrossSection_roadId_startPk_endPk_idx" ON "RoadCrossSection"("roadId", "startPk", "endPk");

-- CreateIndex
CREATE INDEX "RoadCrossSection_status_idx" ON "RoadCrossSection"("status");

-- CreateIndex
CREATE INDEX "RoadCrossSection_sourceDocumentId_idx" ON "RoadCrossSection"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "RoadCrossSection_referenceRoadId_idx" ON "RoadCrossSection"("referenceRoadId");

-- AddForeignKey
ALTER TABLE "RoadCrossSection" ADD CONSTRAINT "RoadCrossSection_roadId_fkey" FOREIGN KEY ("roadId") REFERENCES "RoadSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadCrossSection" ADD CONSTRAINT "RoadCrossSection_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ReceivedDocumentLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadCrossSection" ADD CONSTRAINT "RoadCrossSection_referenceRoadId_fkey" FOREIGN KEY ("referenceRoadId") REFERENCES "RoadSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
