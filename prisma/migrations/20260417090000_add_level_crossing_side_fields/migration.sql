-- Add levelCrossingSide to interval/request/entry for level-crossing specific side tracking
DO $$
BEGIN
  CREATE TYPE "LevelCrossingSide" AS ENUM ('LEFT', 'RIGHT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "PhaseInterval"
  ADD COLUMN IF NOT EXISTS "levelCrossingSide" "LevelCrossingSide";
CREATE INDEX IF NOT EXISTS "PhaseInterval_levelCrossingSide_idx"
  ON "PhaseInterval"("levelCrossingSide");

ALTER TABLE "InspectionRequest"
  ADD COLUMN IF NOT EXISTS "levelCrossingSide" "LevelCrossingSide";
CREATE INDEX IF NOT EXISTS "InspectionRequest_levelCrossingSide_idx"
  ON "InspectionRequest"("levelCrossingSide");

ALTER TABLE "InspectionEntry"
  ADD COLUMN IF NOT EXISTS "levelCrossingSide" "LevelCrossingSide";
CREATE INDEX IF NOT EXISTS "InspectionEntry_levelCrossingSide_idx"
  ON "InspectionEntry"("levelCrossingSide");
