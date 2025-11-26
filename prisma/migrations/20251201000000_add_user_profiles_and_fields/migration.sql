-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'TERMINATED', 'ON_LEAVE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "joinDate" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "position" TEXT,
ADD COLUMN     "terminationDate" TIMESTAMP(3),
ADD COLUMN     "terminationReason" TEXT,
ADD COLUMN     "updatedById" INTEGER;

-- CreateTable
CREATE TABLE "UserChineseProfile" (
    "userId" INTEGER NOT NULL,
    "frenchName" TEXT,
    "idNumber" TEXT,
    "passportNumber" TEXT,
    "educationAndMajor" TEXT,
    "certifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "domesticMobile" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "redBookValidYears" INTEGER DEFAULT 0,
    "cumulativeAbroadYears" INTEGER DEFAULT 0,
    "birthplace" TEXT,
    "residenceInChina" TEXT,
    "medicalHistory" TEXT,
    "healthStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserChineseProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserExpatProfile" (
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserExpatProfile_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChineseProfile" ADD CONSTRAINT "UserChineseProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExpatProfile" ADD CONSTRAINT "UserExpatProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
