-- Add submit/update metadata and appointment date to InspectionRequest
ALTER TABLE "InspectionRequest"
  ADD COLUMN IF NOT EXISTS "appointmentDate" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "submittedBy" INTEGER,
  ADD COLUMN IF NOT EXISTS "updatedBy" INTEGER;

-- Backfill submittedAt with createdAt for existing rows
UPDATE "InspectionRequest" SET "submittedAt" = COALESCE("submittedAt", "createdAt");

ALTER TABLE "InspectionRequest"
  ADD CONSTRAINT "InspectionRequest_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "InspectionRequest_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "InspectionRequest_appointmentDate_idx" ON "InspectionRequest"("appointmentDate");
