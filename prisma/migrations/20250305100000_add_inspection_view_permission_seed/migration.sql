-- Seed inspection:view permission (view-only)
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES ('inspection:view', '报检查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind to Admin only (Employee 已被移除，不再绑定)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (VALUES ('Admin', 'inspection:view')) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
