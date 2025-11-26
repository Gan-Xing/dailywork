-- Ensure Admin owns every permission code
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.name = 'Admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
