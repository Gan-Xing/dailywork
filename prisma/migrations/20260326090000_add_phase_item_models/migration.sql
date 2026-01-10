-- CreateTable
CREATE TABLE "PhaseItemFormula" (
    "id" SERIAL NOT NULL,
    "phaseItemId" INTEGER NOT NULL,
    "expression" TEXT NOT NULL,
    "inputSchema" JSONB,
    "unitString" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhaseItemFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseItemBoqItem" (
    "id" SERIAL NOT NULL,
    "phaseItemId" INTEGER NOT NULL,
    "boqItemId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhaseItemBoqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseItemInput" (
    "id" SERIAL NOT NULL,
    "phaseItemId" INTEGER NOT NULL,
    "intervalId" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "computedQuantity" DECIMAL(18,4),
    "manualQuantity" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhaseItemInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhaseItemFormula_phaseItemId_key" ON "PhaseItemFormula"("phaseItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseItemBoqItem_phaseItemId_boqItemId_key" ON "PhaseItemBoqItem"("phaseItemId", "boqItemId");

-- CreateIndex
CREATE INDEX "PhaseItemBoqItem_boqItemId_idx" ON "PhaseItemBoqItem"("boqItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseItemInput_phaseItemId_intervalId_key" ON "PhaseItemInput"("phaseItemId", "intervalId");

-- CreateIndex
CREATE INDEX "PhaseItemInput_intervalId_idx" ON "PhaseItemInput"("intervalId");

-- AddForeignKey
ALTER TABLE "PhaseItemFormula" ADD CONSTRAINT "PhaseItemFormula_phaseItemId_fkey"
  FOREIGN KEY ("phaseItemId") REFERENCES "PhasePriceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseItemBoqItem" ADD CONSTRAINT "PhaseItemBoqItem_phaseItemId_fkey"
  FOREIGN KEY ("phaseItemId") REFERENCES "PhasePriceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseItemBoqItem" ADD CONSTRAINT "PhaseItemBoqItem_boqItemId_fkey"
  FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseItemInput" ADD CONSTRAINT "PhaseItemInput_phaseItemId_fkey"
  FOREIGN KEY ("phaseItemId") REFERENCES "PhasePriceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseItemInput" ADD CONSTRAINT "PhaseItemInput_intervalId_fkey"
  FOREIGN KEY ("intervalId") REFERENCES "PhaseInterval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
