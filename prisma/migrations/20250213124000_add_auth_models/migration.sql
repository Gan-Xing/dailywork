-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed permissions
INSERT INTO "Permission" ("code", "name", "createdAt", "updatedAt")
VALUES
  ('road:manage', '路段管理', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('report:edit', '日报修改', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Seed roles
INSERT INTO "Role" ("name", "createdAt", "updatedAt")
VALUES
  ('Admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Employee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Seed default users
INSERT INTO "User" ("username", "passwordHash", "createdAt", "updatedAt")
VALUES
  ('GanXing', '4d386763c2c3faa4f355f6777b0a021e:6fcb63494372c67dbd7cea57d83631c804a8fe5c9c3307a0b4a8221679b45386615a29fb04c2c28f33ba549364918c709437f5f05e37e5f6b0770e348a8fbeef', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('User1', '1c5549342db4779684a935fbd738f49c:187b3494e4ab4900e34c58896d71084dac0871cec884f207eb04ee39e8fef3930f3a8b703309fd2656bd446db3f1c83e225748b47a7a66a276f073050c9c45b8', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("username") DO NOTHING;

-- Bind role ↔ permission
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM (VALUES ('Admin', 'road:manage'), ('Admin', 'report:edit'), ('Employee', 'report:edit')) AS rp(role_name, perm_code)
JOIN "Role" r ON r.name = rp.role_name
JOIN "Permission" p ON p.code = rp.perm_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Bind user ↔ role
INSERT INTO "UserRole" ("userId", "roleId")
SELECT u.id, r.id
FROM (VALUES ('GanXing', 'Admin'), ('User1', 'Employee')) AS ur(username, role_name)
JOIN "User" u ON u.username = ur.username
JOIN "Role" r ON r.name = ur.role_name
ON CONFLICT ("userId", "roleId") DO NOTHING;
