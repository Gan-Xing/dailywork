-- Add layers array to phase intervals for per-point layer customization
ALTER TABLE "PhaseInterval"
ADD COLUMN IF NOT EXISTS "layers" TEXT[] NOT NULL DEFAULT '{}';
