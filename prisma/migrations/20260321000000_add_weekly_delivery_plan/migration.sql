-- CreateTable
CREATE TABLE "WeeklyDeliveryPlan" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "session" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "approverName" TEXT,
    "editorName" TEXT,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyDeliveryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyDeliveryPlanItem" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deliveryDate" TEXT,
    "supplier" TEXT,
    "goodsName" TEXT,
    "model" JSONB,
    "unit" TEXT,
    "plannedQty" DECIMAL(18,4),
    "transporter" TEXT,
    "plateNumber" TEXT,
    "phone" TEXT,
    "actualQty" DECIMAL(18,4),
    "unitPrice" DECIMAL(18,4),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyDeliveryPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyDeliveryPlan_projectId_month_session_key" ON "WeeklyDeliveryPlan"("projectId", "month", "session");

-- CreateIndex
CREATE INDEX "WeeklyDeliveryPlan_projectId_idx" ON "WeeklyDeliveryPlan"("projectId");

-- CreateIndex
CREATE INDEX "WeeklyDeliveryPlanItem_planId_sortOrder_idx" ON "WeeklyDeliveryPlanItem"("planId", "sortOrder");

-- AddForeignKey
ALTER TABLE "WeeklyDeliveryPlan" ADD CONSTRAINT "WeeklyDeliveryPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyDeliveryPlan" ADD CONSTRAINT "WeeklyDeliveryPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyDeliveryPlan" ADD CONSTRAINT "WeeklyDeliveryPlan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyDeliveryPlanItem" ADD CONSTRAINT "WeeklyDeliveryPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WeeklyDeliveryPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
