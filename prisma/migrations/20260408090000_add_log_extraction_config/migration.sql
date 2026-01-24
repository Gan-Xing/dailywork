-- CreateTable
CREATE TABLE "LogExtractionConfig" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'daily-report-extractor',
    "promptText" TEXT NOT NULL,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogExtractionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogExtractionConfig_key_key" ON "LogExtractionConfig"("key");

-- AddForeignKey
ALTER TABLE "LogExtractionConfig" ADD CONSTRAINT "LogExtractionConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
