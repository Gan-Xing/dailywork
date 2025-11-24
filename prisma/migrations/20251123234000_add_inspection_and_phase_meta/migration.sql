-- Add enum for inspection status
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED');

-- Extend RoadPhase with common layers/checks
ALTER TABLE "RoadPhase" ADD COLUMN "commonLayers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "RoadPhase" ADD COLUMN "commonChecks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Create inspection request table
CREATE TABLE "InspectionRequest" (
    "id" SERIAL PRIMARY KEY,
    "roadId" INTEGER NOT NULL,
    "phaseId" INTEGER NOT NULL,
    "side" "IntervalSide" NOT NULL,
    "startPk" DOUBLE PRECISION NOT NULL,
    "endPk" DOUBLE PRECISION NOT NULL,
    "layers" TEXT[] NOT NULL,
    "checks" TEXT[] NOT NULL,
    "types" TEXT[] NOT NULL,
    "remark" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- FKs
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_roadId_fkey" FOREIGN KEY ("roadId") REFERENCES "RoadSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "RoadPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "InspectionRequest_phaseId_idx" ON "InspectionRequest"("phaseId");
CREATE INDEX "InspectionRequest_roadId_idx" ON "InspectionRequest"("roadId");
