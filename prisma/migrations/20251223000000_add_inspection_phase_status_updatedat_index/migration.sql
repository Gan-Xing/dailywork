-- Add composite index to speed up filtering latest approved inspections by phase
CREATE INDEX "InspectionRequest_phaseId_status_updatedAt_idx"
  ON "InspectionRequest"("phaseId", "status", "updatedAt");
