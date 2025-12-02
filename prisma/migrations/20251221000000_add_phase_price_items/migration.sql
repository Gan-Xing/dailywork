CREATE TABLE "PhasePriceItem" (
  "id" SERIAL PRIMARY KEY,
  "phaseDefinitionId" INTEGER NOT NULL REFERENCES "PhaseDefinition"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "spec" TEXT,
  "measure" "PhaseMeasure" NOT NULL,
  "unitString" TEXT,
  "description" TEXT,
  "unitPrice" NUMERIC(18, 2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PhasePriceItem_phaseDefinitionId_index" ON "PhasePriceItem" ("phaseDefinitionId");
