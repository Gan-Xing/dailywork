-- Add locationRoadId to InspectionRequest
ALTER TABLE "InspectionRequest" ADD COLUMN IF NOT EXISTS "locationRoadId" INTEGER;

ALTER TABLE "InspectionRequest"
  ADD CONSTRAINT "InspectionRequest_locationRoadId_fkey"
  FOREIGN KEY ("locationRoadId") REFERENCES "RoadSection"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "InspectionRequest_locationRoadId_idx" ON "InspectionRequest"("locationRoadId");
