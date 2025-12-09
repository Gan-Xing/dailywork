-- Add inspection bulk edit permission and bind to Admin by default
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES ('inspection:bulk-edit', '批量编辑报检', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
JOIN "Permission" p ON p.code = 'inspection:bulk-edit'
WHERE r.name = 'Admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
