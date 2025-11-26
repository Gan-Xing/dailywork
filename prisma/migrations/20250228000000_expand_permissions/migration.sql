-- Seed additional permissions for RBAC coverage
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES
  ('member:view', '成员查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('member:edit', '成员编辑', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('member:manage', '成员管理', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role:manage', '角色管理', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('permission:view', '权限查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('road:view', '路段查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('progress:view', '进度查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('progress:edit', '进度编辑', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('inspection:create', '发起报检', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('report:view', '日报查看', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Bind new permissions to Admin (full access)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Admin', 'member:view'),
    ('Admin', 'member:edit'),
    ('Admin', 'member:manage'),
    ('Admin', 'role:manage'),
    ('Admin', 'permission:view'),
    ('Admin', 'road:view'),
    ('Admin', 'progress:view'),
    ('Admin', 'progress:edit'),
    ('Admin', 'inspection:create'),
    ('Admin', 'report:view')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Bind new permissions to Employee (read/view + report/inspection actions)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (
  VALUES
    ('Employee', 'road:view'),
    ('Employee', 'progress:view'),
    ('Employee', 'inspection:create'),
    ('Employee', 'report:view')
) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
