-- AlterTable
ALTER TABLE "BoqMeasurementDetail"
ADD COLUMN "startPk" TEXT,
ADD COLUMN "endPk" TEXT,
ADD COLUMN "side" "IntervalSide";

-- CreateIndex
CREATE INDEX "BoqMeasurementDetail_side_period_idx"
ON "BoqMeasurementDetail"("side", "period");
