-- Seed AI chat permissions
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES
  ('ai-chat:view', 'AI 对话访问', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ai-chat:debug', 'AI 对话调试', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind AI chat permissions to Admin by default
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'ai-chat:view'),
    ('Admin', 'ai-chat:debug')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
