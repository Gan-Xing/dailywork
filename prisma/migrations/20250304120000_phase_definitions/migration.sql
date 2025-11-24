-- Create definition tables
CREATE TABLE "PhaseDefinition" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "measure" "PhaseMeasure" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "LayerDefinition" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "CheckDefinition" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "PhaseDefinitionLayer" (
    "phaseDefinitionId" INTEGER NOT NULL,
    "layerDefinitionId" INTEGER NOT NULL,
    CONSTRAINT "PhaseDefinitionLayer_pkey" PRIMARY KEY ("phaseDefinitionId","layerDefinitionId")
);

CREATE TABLE "PhaseDefinitionCheck" (
    "phaseDefinitionId" INTEGER NOT NULL,
    "checkDefinitionId" INTEGER NOT NULL,
    CONSTRAINT "PhaseDefinitionCheck_pkey" PRIMARY KEY ("phaseDefinitionId","checkDefinitionId")
);

CREATE TABLE "RoadPhaseLayer" (
    "roadPhaseId" INTEGER NOT NULL,
    "layerDefinitionId" INTEGER NOT NULL,
    CONSTRAINT "RoadPhaseLayer_pkey" PRIMARY KEY ("roadPhaseId","layerDefinitionId")
);

CREATE TABLE "RoadPhaseCheck" (
    "roadPhaseId" INTEGER NOT NULL,
    "checkDefinitionId" INTEGER NOT NULL,
    CONSTRAINT "RoadPhaseCheck_pkey" PRIMARY KEY ("roadPhaseId","checkDefinitionId")
);

-- Add phaseDefinitionId to RoadPhase
ALTER TABLE "RoadPhase" ADD COLUMN "phaseDefinitionId" INTEGER;

-- Seed PhaseDefinition from existing phases
INSERT INTO "PhaseDefinition" ("name", "measure", "isActive", "createdAt", "updatedAt")
SELECT DISTINCT "name", "measure", TRUE, NOW(), NOW() FROM "RoadPhase";

UPDATE "RoadPhase" rp
SET "phaseDefinitionId" = pd.id
FROM "PhaseDefinition" pd
WHERE pd.name = rp.name AND pd.measure = rp.measure;

-- Seed LayerDefinition and CheckDefinition from existing columns
INSERT INTO "LayerDefinition" ("name", "isActive", "createdAt", "updatedAt")
SELECT DISTINCT TRIM(layer) AS name, TRUE, NOW(), NOW()
FROM (
  SELECT UNNEST(COALESCE("commonLayers", ARRAY[]::TEXT[])) AS layer FROM "RoadPhase"
) t
WHERE layer IS NOT NULL AND TRIM(layer) <> ''
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "CheckDefinition" ("name", "isActive", "createdAt", "updatedAt")
SELECT DISTINCT TRIM(chk) AS name, TRUE, NOW(), NOW()
FROM (
  SELECT UNNEST(COALESCE("commonChecks", ARRAY[]::TEXT[])) AS chk FROM "RoadPhase"
) t
WHERE chk IS NOT NULL AND TRIM(chk) <> ''
ON CONFLICT ("name") DO NOTHING;

-- Link definitions to default layers/checks (based on historical phase values)
INSERT INTO "PhaseDefinitionLayer" ("phaseDefinitionId", "layerDefinitionId")
SELECT DISTINCT pd.id, ld.id
FROM "RoadPhase" rp
JOIN "PhaseDefinition" pd ON pd.name = rp.name AND pd.measure = rp.measure
JOIN LATERAL UNNEST(COALESCE(rp."commonLayers", ARRAY[]::TEXT[])) AS layer ON TRUE
JOIN "LayerDefinition" ld ON ld.name = layer
ON CONFLICT DO NOTHING;

INSERT INTO "PhaseDefinitionCheck" ("phaseDefinitionId", "checkDefinitionId")
SELECT DISTINCT pd.id, cd.id
FROM "RoadPhase" rp
JOIN "PhaseDefinition" pd ON pd.name = rp.name AND pd.measure = rp.measure
JOIN LATERAL UNNEST(COALESCE(rp."commonChecks", ARRAY[]::TEXT[])) AS chk ON TRUE
JOIN "CheckDefinition" cd ON cd.name = chk
ON CONFLICT DO NOTHING;

-- Remove old columns
ALTER TABLE "RoadPhase" DROP COLUMN "commonLayers";
ALTER TABLE "RoadPhase" DROP COLUMN "commonChecks";

-- Enforce NOT NULL + FK
ALTER TABLE "RoadPhase"
  ALTER COLUMN "phaseDefinitionId" SET NOT NULL,
  ADD CONSTRAINT "RoadPhase_phaseDefinitionId_fkey" FOREIGN KEY ("phaseDefinitionId") REFERENCES "PhaseDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add FKs for new join tables
ALTER TABLE "PhaseDefinitionLayer"
  ADD CONSTRAINT "PhaseDefinitionLayer_phaseDefinitionId_fkey" FOREIGN KEY ("phaseDefinitionId") REFERENCES "PhaseDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PhaseDefinitionLayer_layerDefinitionId_fkey" FOREIGN KEY ("layerDefinitionId") REFERENCES "LayerDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhaseDefinitionCheck"
  ADD CONSTRAINT "PhaseDefinitionCheck_phaseDefinitionId_fkey" FOREIGN KEY ("phaseDefinitionId") REFERENCES "PhaseDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PhaseDefinitionCheck_checkDefinitionId_fkey" FOREIGN KEY ("checkDefinitionId") REFERENCES "CheckDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoadPhaseLayer"
  ADD CONSTRAINT "RoadPhaseLayer_roadPhaseId_fkey" FOREIGN KEY ("roadPhaseId") REFERENCES "RoadPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RoadPhaseLayer_layerDefinitionId_fkey" FOREIGN KEY ("layerDefinitionId") REFERENCES "LayerDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoadPhaseCheck"
  ADD CONSTRAINT "RoadPhaseCheck_roadPhaseId_fkey" FOREIGN KEY ("roadPhaseId") REFERENCES "RoadPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RoadPhaseCheck_checkDefinitionId_fkey" FOREIGN KEY ("checkDefinitionId") REFERENCES "CheckDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
