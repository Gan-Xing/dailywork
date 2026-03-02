-- CreateTable
CREATE TABLE "BoqMeasurementDetail" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "boqItemId" INTEGER NOT NULL,
    "roadId" INTEGER NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "manualAmount" DECIMAL(18,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoqMeasurementDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoqMeasurementDetail_projectId_period_idx" ON "BoqMeasurementDetail"("projectId", "period");

-- CreateIndex
CREATE INDEX "BoqMeasurementDetail_boqItemId_period_idx" ON "BoqMeasurementDetail"("boqItemId", "period");

-- CreateIndex
CREATE INDEX "BoqMeasurementDetail_roadId_period_idx" ON "BoqMeasurementDetail"("roadId", "period");

-- AddForeignKey
ALTER TABLE "BoqMeasurementDetail" ADD CONSTRAINT "BoqMeasurementDetail_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqMeasurementDetail" ADD CONSTRAINT "BoqMeasurementDetail_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqMeasurementDetail" ADD CONSTRAINT "BoqMeasurementDetail_roadId_fkey" FOREIGN KEY ("roadId") REFERENCES "RoadSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
