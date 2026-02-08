-- Add locationRoadId to PhaseInterval and InspectionEntry
ALTER TABLE "PhaseInterval" ADD COLUMN IF NOT EXISTS "locationRoadId" INTEGER;
ALTER TABLE "PhaseInterval"
  ADD CONSTRAINT "PhaseInterval_locationRoadId_fkey"
  FOREIGN KEY ("locationRoadId") REFERENCES "RoadSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "PhaseInterval_locationRoadId_idx" ON "PhaseInterval"("locationRoadId");

ALTER TABLE "InspectionEntry" ADD COLUMN IF NOT EXISTS "locationRoadId" INTEGER;
ALTER TABLE "InspectionEntry"
  ADD CONSTRAINT "InspectionEntry_locationRoadId_fkey"
  FOREIGN KEY ("locationRoadId") REFERENCES "RoadSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "InspectionEntry_locationRoadId_idx" ON "InspectionEntry"("locationRoadId");
