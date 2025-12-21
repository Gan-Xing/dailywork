-- Add status for permissions
CREATE TYPE "PermissionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "Permission"
ADD COLUMN "status" "PermissionStatus" NOT NULL DEFAULT 'ACTIVE';

-- Seed member/role CRUD permissions
INSERT INTO "Permission" ("code", "name", "status", "createdAt", "updatedAt")
VALUES
  ('member:create', '成员新增', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('member:update', '成员更新', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('member:delete', '成员删除', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role:view', '角色查看', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role:create', '角色新增', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role:update', '角色更新', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role:delete', '角色删除', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind new permissions to Admin (full access)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'member:create'),
    ('Admin', 'member:update'),
    ('Admin', 'member:delete'),
    ('Admin', 'role:view'),
    ('Admin', 'role:create'),
    ('Admin', 'role:update'),
    ('Admin', 'role:delete')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
