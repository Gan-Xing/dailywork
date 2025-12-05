-- Seed roadmap module permissions
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES
  ('roadmap:view', '开发路线查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('roadmap:create', '开发路线新增', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('roadmap:update', '开发路线更新', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('roadmap:delete', '开发路线删除', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind roadmap permissions to Admin by default
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'roadmap:view'),
    ('Admin', 'roadmap:create'),
    ('Admin', 'roadmap:update'),
    ('Admin', 'roadmap:delete')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
