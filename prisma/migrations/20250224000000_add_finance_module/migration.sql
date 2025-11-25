-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceUnit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCategory" (
    "key" TEXT NOT NULL,
    "parentKey" TEXT,
    "labelZh" TEXT NOT NULL,
    "labelEn" TEXT,
    "labelFr" TEXT,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" SERIAL NOT NULL,
    "sequence" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "parentKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amount" DECIMAL(18,2) NOT NULL,
    "unitId" INTEGER NOT NULL,
    "paymentTypeId" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "tva" DECIMAL(18,2),
    "remark" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_name_key" ON "Project"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceUnit_name_key" ON "FinanceUnit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentType_name_key" ON "PaymentType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCategory_key_key" ON "FinanceCategory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_sequence_key" ON "FinanceEntry"("sequence");

-- CreateIndex
CREATE INDEX "FinanceEntry_projectId_idx" ON "FinanceEntry"("projectId");

-- CreateIndex
CREATE INDEX "FinanceEntry_categoryKey_idx" ON "FinanceEntry"("categoryKey");

-- CreateIndex
CREATE INDEX "FinanceEntry_paymentDate_idx" ON "FinanceEntry"("paymentDate");

-- CreateIndex
CREATE INDEX "FinanceEntry_isDeleted_idx" ON "FinanceEntry"("isDeleted");

-- AddForeignKey
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_parentKey_fkey" FOREIGN KEY ("parentKey") REFERENCES "FinanceCategory"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_categoryKey_fkey" FOREIGN KEY ("categoryKey") REFERENCES "FinanceCategory"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "FinanceUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PaymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed finance permissions
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES
  ('finance:view', '财务查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('finance:edit', '财务编辑', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('finance:manage', '财务管理', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind new permissions to roles
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (VALUES 
  ('Admin', 'finance:view'),
  ('Admin', 'finance:edit'),
  ('Admin', 'finance:manage'),
  ('Employee', 'finance:view')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Seed default projects
INSERT INTO "Project" ("name", "code", "createdAt", "updatedAt")
VALUES
  ('邦杜库市政路项目', 'project-bondoukou-city', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('邦杜库边境路项目', 'project-bondoukou-border', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('邦杜库供料项目', 'project-bondoukou-supply', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('铁布高速项目', 'project-tieb-highway', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('阿比让办事处', 'project-abidjan-office', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Seed default finance units
INSERT INTO "FinanceUnit" ("name", "symbol", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('西法', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('美金', '$', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('人民币', '¥', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Seed default payment types
INSERT INTO "PaymentType" ("name", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('现金', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('现金支票', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('转账支票', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('办事处代付', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('无票据支出', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
