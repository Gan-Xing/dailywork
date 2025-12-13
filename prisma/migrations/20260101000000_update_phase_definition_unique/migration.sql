-- Adjust unique constraint to allow same name with different measure
ALTER TABLE "PhaseDefinition" DROP CONSTRAINT IF EXISTS "PhaseDefinition_name_key";
DROP INDEX IF EXISTS "PhaseDefinition_name_measure_key";
CREATE UNIQUE INDEX "PhaseDefinition_name_measure_key" ON "PhaseDefinition"("name", "measure");
