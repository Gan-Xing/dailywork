CREATE TABLE "FileAssetLink" (
  "id" SERIAL NOT NULL,
  "fileId" INTEGER NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "purpose" TEXT,
  "label" TEXT,
  "meta" JSONB,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FileAssetLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FileAssetLink_fileId_idx" ON "FileAssetLink"("fileId");
CREATE INDEX "FileAssetLink_entity_idx" ON "FileAssetLink"("entityType", "entityId");
CREATE INDEX "FileAssetLink_purpose_idx" ON "FileAssetLink"("purpose");

ALTER TABLE "FileAssetLink" ADD CONSTRAINT "FileAssetLink_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FileAssetLink" ADD CONSTRAINT "FileAssetLink_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed file permissions
INSERT INTO "Permission" ("code", "name", "status", "createdAt", "updatedAt")
VALUES
  ('file:view', '文件查看', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('file:upload', '文件上传', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('file:update', '文件更新', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('file:delete', '文件删除', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('file:manage', '文件管理', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind file permissions to Admin
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'file:view'),
    ('Admin', 'file:upload'),
    ('Admin', 'file:update'),
    ('Admin', 'file:delete'),
    ('Admin', 'file:manage')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
