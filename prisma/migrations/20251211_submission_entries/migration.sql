-- Migration: introduce InspectionEntry as flat inspection detail table
-- and detach Submission from InspectionRequest (Submission now relates to entries).

-- 1) Drop submissionId column from InspectionRequest (with FK/index if exist)
ALTER TABLE "InspectionRequest" DROP CONSTRAINT IF EXISTS "InspectionRequest_submissionId_fkey";
DROP INDEX IF EXISTS "InspectionRequest_submissionId_idx";
ALTER TABLE "InspectionRequest" DROP COLUMN IF EXISTS "submissionId";

-- 1b) Ensure Submission table exists (for environments that don't have it yet)
CREATE TABLE IF NOT EXISTS "Submission" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "files" JSONB NOT NULL DEFAULT '[]',
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2) Create InspectionEntry table (if not exists)
CREATE TABLE IF NOT EXISTS "InspectionEntry" (
  "id" SERIAL PRIMARY KEY,
  "submissionId" INTEGER NOT NULL,
  "roadId" INTEGER NOT NULL,
  "phaseId" INTEGER NOT NULL,
  "side" "IntervalSide" NOT NULL,
  "startPk" DOUBLE PRECISION NOT NULL,
  "endPk" DOUBLE PRECISION NOT NULL,
  "layerId" INTEGER,
  "layerName" TEXT NOT NULL,
  "checkId" INTEGER,
  "checkName" TEXT NOT NULL,
  "types" TEXT[] NOT NULL DEFAULT '{}',
  "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
  "appointmentDate" TIMESTAMP(3),
  "remark" TEXT,
  "submissionOrder" INTEGER,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedBy" INTEGER,
  "createdBy" INTEGER,
  "updatedBy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3) Foreign keys
ALTER TABLE "InspectionEntry"
  ADD CONSTRAINT "InspectionEntry_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InspectionEntry"
  ADD CONSTRAINT "InspectionEntry_roadId_fkey"
  FOREIGN KEY ("roadId") REFERENCES "RoadSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InspectionEntry"
  ADD CONSTRAINT "InspectionEntry_phaseId_fkey"
  FOREIGN KEY ("phaseId") REFERENCES "RoadPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- User relations for auditing (nullable)
ALTER TABLE "InspectionEntry"
  ADD CONSTRAINT "InspectionEntry_submittedBy_fkey"
  FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspectionEntry"
  ADD CONSTRAINT "InspectionEntry_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspectionEntry"
  ADD CONSTRAINT "InspectionEntry_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Optional FKs to definitions (kept nullable)
ALTER TABLE "InspectionEntry"
  ADD CONSTRAINT "InspectionEntry_layerId_fkey"
  FOREIGN KEY ("layerId") REFERENCES "LayerDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspectionEntry"
  ADD CONSTRAINT "InspectionEntry_checkId_fkey"
  FOREIGN KEY ("checkId") REFERENCES "CheckDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS "InspectionEntry_submissionId_idx" ON "InspectionEntry"("submissionId");
CREATE INDEX IF NOT EXISTS "InspectionEntry_location_idx"
  ON "InspectionEntry"("roadId","phaseId","side","startPk","endPk","status");

-- 5) Ensure Submission table exists (it should), no schema change needed beyond relation swap.
