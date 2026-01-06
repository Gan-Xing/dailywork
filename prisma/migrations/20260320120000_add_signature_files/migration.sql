CREATE TABLE "FileAsset" (
  "id" SERIAL NOT NULL,
  "category" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "checksum" TEXT,
  "ownerUserId" INTEGER,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");
CREATE INDEX "FileAsset_category_idx" ON "FileAsset"("category");
CREATE INDEX "FileAsset_ownerUserId_idx" ON "FileAsset"("ownerUserId");

ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "UserSignature" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "fileId" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSignature_userId_version_key" ON "UserSignature"("userId", "version");
CREATE INDEX "UserSignature_userId_idx" ON "UserSignature"("userId");
CREATE INDEX "UserSignature_fileId_idx" ON "UserSignature"("fileId");
CREATE UNIQUE INDEX "UserSignature_userId_active_key" ON "UserSignature"("userId") WHERE "isActive" = true;

ALTER TABLE "UserSignature" ADD CONSTRAINT "UserSignature_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSignature" ADD CONSTRAINT "UserSignature_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSignature" ADD CONSTRAINT "UserSignature_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed signature permissions
INSERT INTO "Permission" ("code", "name", "status", "createdAt", "updatedAt")
VALUES
  ('signature:view', '签名查看', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('signature:use', '签名使用', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('signature:upload', '签名上传', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('signature:delete', '签名删除', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind signature permissions to Admin
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'signature:view'),
    ('Admin', 'signature:use'),
    ('Admin', 'signature:upload'),
    ('Admin', 'signature:delete')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
