-- Add optional equipment type key to machine assets (for grouping & reporting).
ALTER TABLE "MachineAsset" ADD COLUMN "equipmentTypeKey" TEXT;

CREATE INDEX "MachineAsset_equipmentTypeKey_idx" ON "MachineAsset"("equipmentTypeKey");

