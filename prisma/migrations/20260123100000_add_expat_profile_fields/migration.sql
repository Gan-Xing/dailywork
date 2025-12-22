-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CTJ', 'CDD');

-- CreateEnum
CREATE TYPE "SalaryUnit" AS ENUM ('MONTH', 'HOUR');

-- AlterTable
ALTER TABLE "UserExpatProfile"
ADD COLUMN     "team" TEXT,
ADD COLUMN     "contractNumber" TEXT,
ADD COLUMN     "contractType" "ContractType",
ADD COLUMN     "salaryCategory" TEXT,
ADD COLUMN     "baseSalaryAmount" DECIMAL(18, 2),
ADD COLUMN     "baseSalaryUnit" "SalaryUnit",
ADD COLUMN     "netMonthlyAmount" DECIMAL(18, 2),
ADD COLUMN     "netMonthlyUnit" "SalaryUnit",
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "childrenCount" INTEGER,
ADD COLUMN     "cnpsNumber" TEXT,
ADD COLUMN     "cnpsDeclarationCode" TEXT,
ADD COLUMN     "provenance" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserExpatProfile_contractNumber_key" ON "UserExpatProfile"("contractNumber");
