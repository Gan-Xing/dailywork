-- CreateEnum
CREATE TYPE "RoadmapStatus" AS ENUM ('PENDING', 'DONE');

-- CreateTable
CREATE TABLE "RoadmapIdea" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" "RoadmapStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadmapIdea_status_createdAt_idx" ON "RoadmapIdea"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "RoadmapIdea" ADD CONSTRAINT "RoadmapIdea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapIdea" ADD CONSTRAINT "RoadmapIdea_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
