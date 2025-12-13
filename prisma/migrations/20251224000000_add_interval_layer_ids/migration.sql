-- Add per-interval layer ID references for PhaseInterval entries
ALTER TABLE "PhaseInterval"
ADD COLUMN "layerIds" INTEGER[] NOT NULL DEFAULT '{}';
