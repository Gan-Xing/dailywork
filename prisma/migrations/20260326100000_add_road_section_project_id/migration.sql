ALTER TABLE "RoadSection" ADD COLUMN "projectId" INTEGER;

CREATE INDEX "RoadSection_projectId_idx" ON "RoadSection"("projectId");

ALTER TABLE "RoadSection" ADD CONSTRAINT "RoadSection_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
