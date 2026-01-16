-- CreateTable
CREATE TABLE "LeaderDailyLog" (
    "id" SERIAL NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "supervisorName" TEXT NOT NULL,
    "contentRaw" TEXT NOT NULL,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderDailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaderDailyLog_logDate_supervisorId_key" ON "LeaderDailyLog"("logDate", "supervisorId");

-- CreateIndex
CREATE INDEX "LeaderDailyLog_logDate_idx" ON "LeaderDailyLog"("logDate");

-- CreateIndex
CREATE INDEX "LeaderDailyLog_supervisorId_idx" ON "LeaderDailyLog"("supervisorId");

-- AddForeignKey
ALTER TABLE "LeaderDailyLog" ADD CONSTRAINT "LeaderDailyLog_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderDailyLog" ADD CONSTRAINT "LeaderDailyLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderDailyLog" ADD CONSTRAINT "LeaderDailyLog_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
