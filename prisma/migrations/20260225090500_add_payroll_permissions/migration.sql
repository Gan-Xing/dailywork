-- Seed payroll permissions
INSERT INTO "Permission" ("code", "name", "status", "createdAt", "updatedAt")
VALUES
  ('payroll:view', '工资发放查看', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('payroll:manage', '工资发放管理', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind payroll permissions to Admin
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'payroll:view'),
    ('Admin', 'payroll:manage')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
