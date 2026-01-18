-- Seed leader log permissions
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES
  ('leader-log:view-all', '原始日志全员查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('leader-log:edit-all', '原始日志全员编辑', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind leader log permissions to Admin by default
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'leader-log:view-all'),
    ('Admin', 'leader-log:edit-all')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
