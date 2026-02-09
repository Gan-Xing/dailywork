-- CreateEnum
CREATE TYPE "FuelSourceType" AS ENUM ('TANK', 'TRUCK');

-- CreateTable
CREATE TABLE "MachineDailyLog" (
    "id" SERIAL NOT NULL,
    "machineId" INTEGER NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "team" TEXT,
    "teamKey" TEXT,
    "chineseSupervisorId" INTEGER,
    "chineseSupervisorName" TEXT,
    "projectId" INTEGER,
    "operatorId" INTEGER,
    "operatorName" TEXT,
    "workContent" TEXT,
    "fuelRemainingEnd" DECIMAL(18,2),
    "dailyDepreciation" DECIMAL(18,2),
    "meta" JSONB,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineDailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelSource" (
    "id" SERIAL NOT NULL,
    "type" "FuelSourceType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "machineId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineFuelEvent" (
    "id" SERIAL NOT NULL,
    "dailyLogId" INTEGER NOT NULL,
    "fuelSourceId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineFuelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelSourceDailyLog" (
    "id" SERIAL NOT NULL,
    "fuelSourceId" INTEGER NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "received" DECIMAL(18,2),
    "remainingEnd" DECIMAL(18,2),
    "note" TEXT,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelSourceDailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MachineDailyLog_machineId_logDate_key" ON "MachineDailyLog"("machineId", "logDate");

-- CreateIndex
CREATE INDEX "MachineDailyLog_logDate_idx" ON "MachineDailyLog"("logDate");

-- CreateIndex
CREATE INDEX "MachineDailyLog_machineId_idx" ON "MachineDailyLog"("machineId");

-- CreateIndex
CREATE INDEX "MachineDailyLog_teamKey_idx" ON "MachineDailyLog"("teamKey");

-- CreateIndex
CREATE INDEX "MachineDailyLog_chineseSupervisorId_idx" ON "MachineDailyLog"("chineseSupervisorId");

-- CreateIndex
CREATE INDEX "MachineDailyLog_projectId_idx" ON "MachineDailyLog"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "FuelSource_code_key" ON "FuelSource"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FuelSource_machineId_key" ON "FuelSource"("machineId");

-- CreateIndex
CREATE INDEX "FuelSource_type_idx" ON "FuelSource"("type");

-- CreateIndex
CREATE INDEX "FuelSource_isActive_idx" ON "FuelSource"("isActive");

-- CreateIndex
CREATE INDEX "MachineFuelEvent_dailyLogId_idx" ON "MachineFuelEvent"("dailyLogId");

-- CreateIndex
CREATE INDEX "MachineFuelEvent_fuelSourceId_idx" ON "MachineFuelEvent"("fuelSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "FuelSourceDailyLog_fuelSourceId_logDate_key" ON "FuelSourceDailyLog"("fuelSourceId", "logDate");

-- CreateIndex
CREATE INDEX "FuelSourceDailyLog_logDate_idx" ON "FuelSourceDailyLog"("logDate");

-- CreateIndex
CREATE INDEX "FuelSourceDailyLog_fuelSourceId_idx" ON "FuelSourceDailyLog"("fuelSourceId");

-- AddForeignKey
ALTER TABLE "MachineDailyLog" ADD CONSTRAINT "MachineDailyLog_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDailyLog" ADD CONSTRAINT "MachineDailyLog_chineseSupervisorId_fkey" FOREIGN KEY ("chineseSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDailyLog" ADD CONSTRAINT "MachineDailyLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDailyLog" ADD CONSTRAINT "MachineDailyLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDailyLog" ADD CONSTRAINT "MachineDailyLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDailyLog" ADD CONSTRAINT "MachineDailyLog_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelSource" ADD CONSTRAINT "FuelSource_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineFuelEvent" ADD CONSTRAINT "MachineFuelEvent_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "MachineDailyLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineFuelEvent" ADD CONSTRAINT "MachineFuelEvent_fuelSourceId_fkey" FOREIGN KEY ("fuelSourceId") REFERENCES "FuelSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelSourceDailyLog" ADD CONSTRAINT "FuelSourceDailyLog_fuelSourceId_fkey" FOREIGN KEY ("fuelSourceId") REFERENCES "FuelSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelSourceDailyLog" ADD CONSTRAINT "FuelSourceDailyLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelSourceDailyLog" ADD CONSTRAINT "FuelSourceDailyLog_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed permissions (machine logs + fuel sources)
INSERT INTO "Permission" ("code", "name", "status", "createdAt", "updatedAt")
VALUES
  ('machine-log:view', '机械日志查看', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('machine-log:create', '机械日志新增', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('machine-log:update', '机械日志更新', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('machine-log:delete', '机械日志删除', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('fuel-source:view', '加油来源查看', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('fuel-source:create', '加油来源新增', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('fuel-source:update', '加油来源更新', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('fuel-source:delete', '加油来源删除', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind new permissions to Admin by default
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'machine-log:view'),
    ('Admin', 'machine-log:create'),
    ('Admin', 'machine-log:update'),
    ('Admin', 'machine-log:delete'),
    ('Admin', 'fuel-source:view'),
    ('Admin', 'fuel-source:create'),
    ('Admin', 'fuel-source:update'),
    ('Admin', 'fuel-source:delete')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Seed default fuel sources: Tank 1/2
INSERT INTO "FuelSource" ("type", "code", "name", "machineId", "isActive", "createdAt", "updatedAt")
VALUES
  ('TANK', 'TANK_1', '1号加油罐', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('TANK', 'TANK_2', '2号加油罐', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
