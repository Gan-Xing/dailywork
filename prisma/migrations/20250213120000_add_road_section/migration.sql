-- CreateTable
CREATE TABLE "RoadSection" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startPk" TEXT NOT NULL,
    "endPk" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadSection_pkey" PRIMARY KEY ("id")
);
