CREATE TABLE "WeeklyDeliveryPlanProject" (
    "planId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeeklyDeliveryPlanProject_pkey" PRIMARY KEY ("planId","projectId")
);

CREATE INDEX "WeeklyDeliveryPlanProject_projectId_idx" ON "WeeklyDeliveryPlanProject"("projectId");
CREATE INDEX "WeeklyDeliveryPlanProject_planId_sortOrder_idx" ON "WeeklyDeliveryPlanProject"("planId", "sortOrder");

ALTER TABLE "WeeklyDeliveryPlanProject"
ADD CONSTRAINT "WeeklyDeliveryPlanProject_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "WeeklyDeliveryPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyDeliveryPlanProject"
ADD CONSTRAINT "WeeklyDeliveryPlanProject_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WeeklyDeliveryPlanProject" ("planId", "projectId", "sortOrder")
SELECT "id", "projectId", 0
FROM "WeeklyDeliveryPlan"
ON CONFLICT ("planId", "projectId") DO NOTHING;
