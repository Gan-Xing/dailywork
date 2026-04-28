CREATE TABLE "TeamSupervisorHistory" (
    "id" SERIAL NOT NULL,
    "teamSupervisorId" INTEGER,
    "team" TEXT NOT NULL,
    "teamFr" TEXT,
    "teamZh" TEXT,
    "teamKey" TEXT NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "supervisorName" TEXT,
    "projectId" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamSupervisorHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamSupervisorHistory_teamSupervisorId_idx" ON "TeamSupervisorHistory"("teamSupervisorId");
CREATE INDEX "TeamSupervisorHistory_teamKey_idx" ON "TeamSupervisorHistory"("teamKey");
CREATE INDEX "TeamSupervisorHistory_teamKey_effectiveFrom_idx" ON "TeamSupervisorHistory"("teamKey", "effectiveFrom");
CREATE INDEX "TeamSupervisorHistory_effectiveFrom_idx" ON "TeamSupervisorHistory"("effectiveFrom");
CREATE INDEX "TeamSupervisorHistory_effectiveTo_idx" ON "TeamSupervisorHistory"("effectiveTo");

ALTER TABLE "TeamSupervisorHistory"
  ADD CONSTRAINT "TeamSupervisorHistory_teamSupervisorId_fkey"
  FOREIGN KEY ("teamSupervisorId") REFERENCES "TeamSupervisor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "TeamSupervisorHistory" (
  "teamSupervisorId",
  "team",
  "teamFr",
  "teamZh",
  "teamKey",
  "supervisorId",
  "supervisorName",
  "projectId",
  "effectiveFrom",
  "effectiveTo"
)
SELECT
  "id",
  "team",
  "teamFr",
  "teamZh",
  "teamKey",
  "supervisorId",
  "supervisorName",
  "projectId",
  "createdAt",
  NULL
FROM "TeamSupervisor";
