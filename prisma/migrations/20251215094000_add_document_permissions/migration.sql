-- Seed document permissions for submissions and templates
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES
  ('submission:view', '提交单查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('submission:create', '提交单新增', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('submission:update', '提交单编辑', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('submission:delete', '提交单删除', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('template:view', '文档模板查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('template:create', '文档模板新增', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('template:update', '文档模板编辑', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('template:delete', '文档模板删除', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind new permissions to Admin by default
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'submission:view'),
    ('Admin', 'submission:create'),
    ('Admin', 'submission:update'),
    ('Admin', 'submission:delete'),
    ('Admin', 'template:view'),
    ('Admin', 'template:create'),
    ('Admin', 'template:update'),
    ('Admin', 'template:delete')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
