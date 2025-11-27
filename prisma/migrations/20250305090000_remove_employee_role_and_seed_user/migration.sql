-- Remove Employee role bindings
DELETE FROM "RolePermission"
WHERE "roleId" IN (SELECT id FROM "Role" WHERE "name" = 'Employee');

-- Remove UserRole links to Employee
DELETE FROM "UserRole"
WHERE "roleId" IN (SELECT id FROM "Role" WHERE "name" = 'Employee');

-- Delete Employee role
DELETE FROM "Role" WHERE "name" = 'Employee';

-- Remove seeded default user User1 if still present
DELETE FROM "User" WHERE "username" = 'User1';
