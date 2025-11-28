-- Add boolean flag to allow point phases to display by side
ALTER TABLE "PhaseDefinition" ADD COLUMN IF NOT EXISTS "pointHasSides" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RoadPhase" ADD COLUMN IF NOT EXISTS "pointHasSides" BOOLEAN NOT NULL DEFAULT false;
