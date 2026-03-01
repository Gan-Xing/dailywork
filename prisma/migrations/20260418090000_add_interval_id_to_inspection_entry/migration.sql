-- Add interval identity for inspection entries so level crossing point intervals can be isolated
ALTER TABLE "InspectionEntry"
ADD COLUMN "intervalId" INTEGER;

CREATE INDEX "InspectionEntry_intervalId_idx" ON "InspectionEntry"("intervalId");

ALTER TABLE "InspectionEntry"
ADD CONSTRAINT "InspectionEntry_intervalId_fkey"
FOREIGN KEY ("intervalId") REFERENCES "PhaseInterval"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
