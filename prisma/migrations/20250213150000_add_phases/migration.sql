-- CreateEnum
CREATE TYPE "PhaseMeasure" AS ENUM ('LINEAR');

-- CreateEnum
CREATE TYPE "IntervalSide" AS ENUM ('BOTH', 'LEFT', 'RIGHT');

-- CreateTable
CREATE TABLE "RoadPhase" (
    "id" SERIAL NOT NULL,
    "roadId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "measure" "PhaseMeasure" NOT NULL,
    "designLength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseInterval" (
    "id" SERIAL NOT NULL,
    "phaseId" INTEGER NOT NULL,
    "startPk" DOUBLE PRECISION NOT NULL,
    "endPk" DOUBLE PRECISION NOT NULL,
    "side" "IntervalSide" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhaseInterval_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RoadPhase" ADD CONSTRAINT "RoadPhase_roadId_fkey" FOREIGN KEY ("roadId") REFERENCES "RoadSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseInterval" ADD CONSTRAINT "PhaseInterval_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "RoadPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
