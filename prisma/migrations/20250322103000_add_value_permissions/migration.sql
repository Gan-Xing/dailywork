-- Seed value module CRUD permissions
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES
  ('value:view', '产值查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('value:create', '产值新增', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('value:update', '产值更新', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('value:delete', '产值删除', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind new permissions to Admin by default
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'value:view'),
    ('Admin', 'value:create'),
    ('Admin', 'value:update'),
    ('Admin', 'value:delete')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
