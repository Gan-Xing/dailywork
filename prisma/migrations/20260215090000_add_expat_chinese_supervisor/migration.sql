-- AlterTable
ALTER TABLE "UserExpatProfile" ADD COLUMN     "chineseSupervisorId" INTEGER;

-- AddForeignKey
ALTER TABLE "UserExpatProfile" ADD CONSTRAINT "UserExpatProfile_chineseSupervisorId_fkey" FOREIGN KEY ("chineseSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
