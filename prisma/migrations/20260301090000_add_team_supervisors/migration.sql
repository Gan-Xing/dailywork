-- CreateTable
CREATE TABLE "TeamSupervisor" (
    "id" SERIAL NOT NULL,
    "team" TEXT NOT NULL,
    "teamKey" TEXT NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "supervisorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamSupervisor_teamKey_key" ON "TeamSupervisor"("teamKey");

-- CreateIndex
CREATE INDEX "TeamSupervisor_team_idx" ON "TeamSupervisor"("team");

-- CreateIndex
CREATE INDEX "TeamSupervisor_supervisorId_idx" ON "TeamSupervisor"("supervisorId");

-- AddForeignKey
ALTER TABLE "TeamSupervisor" ADD CONSTRAINT "TeamSupervisor_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
