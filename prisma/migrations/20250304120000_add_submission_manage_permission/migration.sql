-- Add submission:manage permission and bind to Admin role
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES ('submission:manage', '提交单基础字段管理', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
JOIN "Permission" p ON p.code = 'submission:manage'
WHERE r.name = 'Admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
