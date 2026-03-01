-- Allow BOTH for level-crossing side and add template whitelist flag
ALTER TYPE "LevelCrossingSide" ADD VALUE IF NOT EXISTS 'BOTH';

ALTER TABLE "PhaseDefinition"
  ADD COLUMN IF NOT EXISTS "allowLevelCrossingBoth" BOOLEAN NOT NULL DEFAULT false;
