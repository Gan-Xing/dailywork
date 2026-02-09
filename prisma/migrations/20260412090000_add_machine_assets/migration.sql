-- CreateTable
CREATE TABLE "MachineAsset" (
    "id" SERIAL NOT NULL,
    "assetCategoryName" TEXT,
    "assetNumber" TEXT NOT NULL,
    "manufacturer" TEXT,
    "assetName" TEXT,
    "assetStatusName" TEXT,
    "specModel" TEXT,
    "registrationDate" TIMESTAMP(3),
    "originalValue" DECIMAL(18,2),
    "usedMonths" INTEGER,
    "currentValue" DECIMAL(18,2),
    "depreciatedMonths" INTEGER,
    "remainingMonths" INTEGER,
    "usageStatus" TEXT,
    "alias" TEXT,
    "plateNumber" TEXT,
    "photoLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meta" JSONB,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MachineAsset_assetNumber_key" ON "MachineAsset"("assetNumber");

-- CreateIndex
CREATE INDEX "MachineAsset_assetCategoryName_idx" ON "MachineAsset"("assetCategoryName");

-- CreateIndex
CREATE INDEX "MachineAsset_assetStatusName_idx" ON "MachineAsset"("assetStatusName");

-- CreateIndex
CREATE INDEX "MachineAsset_manufacturer_idx" ON "MachineAsset"("manufacturer");

-- CreateIndex
CREATE INDEX "MachineAsset_registrationDate_idx" ON "MachineAsset"("registrationDate");

-- AddForeignKey
ALTER TABLE "MachineAsset" ADD CONSTRAINT "MachineAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAsset" ADD CONSTRAINT "MachineAsset_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed resource permissions (machines + materials)
INSERT INTO "Permission" ("code", "name", "status", "createdAt", "updatedAt")
VALUES
  ('machine:view', '机械台账查看', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('machine:create', '机械台账新增', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('machine:update', '机械台账更新', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('machine:delete', '机械台账删除', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('material:view', '物资台账查看', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('material:create', '物资台账新增', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('material:update', '物资台账更新', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('material:delete', '物资台账删除', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind new permissions to Admin by default
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'machine:view'),
    ('Admin', 'machine:create'),
    ('Admin', 'machine:update'),
    ('Admin', 'machine:delete'),
    ('Admin', 'material:view'),
    ('Admin', 'material:create'),
    ('Admin', 'material:update'),
    ('Admin', 'material:delete')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

