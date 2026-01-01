-- Add project binding to team supervisors
ALTER TABLE "TeamSupervisor" ADD COLUMN "projectId" INTEGER;

-- Create project assignments for members
CREATE TABLE "UserProjectAssignment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamSupervisor_projectId_idx" ON "TeamSupervisor"("projectId");

-- CreateIndex
CREATE INDEX "UserProjectAssignment_userId_idx" ON "UserProjectAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserProjectAssignment_projectId_idx" ON "UserProjectAssignment"("projectId");

-- CreateIndex
CREATE INDEX "UserProjectAssignment_endDate_idx" ON "UserProjectAssignment"("endDate");

-- Ensure only one active project assignment per user
CREATE UNIQUE INDEX "UserProjectAssignment_active_user_key" ON "UserProjectAssignment"("userId") WHERE "endDate" IS NULL;

-- AddForeignKey
ALTER TABLE "TeamSupervisor" ADD CONSTRAINT "TeamSupervisor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectAssignment" ADD CONSTRAINT "UserProjectAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectAssignment" ADD CONSTRAINT "UserProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
