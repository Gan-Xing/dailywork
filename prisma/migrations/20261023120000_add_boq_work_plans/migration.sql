-- New planning domain only. Existing signed bills, measurements and finance rows are not changed.
CREATE TABLE "BoqWorkPlan" (
 "id" SERIAL PRIMARY KEY, "projectId" INTEGER NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "anchorRevisionId" INTEGER NOT NULL REFERENCES "BoqBillRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "anchorLineKey" TEXT NOT NULL, "boqItemId" INTEGER REFERENCES "BoqItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version">0), "state" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("state" IN ('DRAFT','CONFIRMED','CONFIRMED_NONE')),
 "draftJson" JSONB NOT NULL, "confirmedSnapshotJson" JSONB,
 "createdById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "updatedById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BoqWorkPlan_projectId_anchorRevisionId_anchorLineKey_key" ON "BoqWorkPlan"("projectId","anchorRevisionId","anchorLineKey");
CREATE INDEX "BoqWorkPlan_projectId_boqItemId_idx" ON "BoqWorkPlan"("projectId","boqItemId");
CREATE TABLE "BoqWorkScope" (
 "id" UUID PRIMARY KEY, "planId" INTEGER NOT NULL REFERENCES "BoqWorkPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sortOrder" INTEGER NOT NULL DEFAULT 0, "description" TEXT NOT NULL,
 "roadId" INTEGER REFERENCES "RoadSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "startPk" TEXT, "endPk" TEXT, "side" TEXT, "spec" TEXT, "unit" TEXT,
 "completionState" TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK ("completionState" IN ('COMPLETED','NOT_COMPLETED','UNKNOWN')),
 "scopeBasis" TEXT NOT NULL DEFAULT 'ORIGINAL' CHECK ("scopeBasis" IN ('ORIGINAL','APPROVED_CHANGE','PENDING_CHANGE')),
 "quantity" DECIMAL(38,18) CHECK ("quantity" IS NULL OR "quantity">=0), "quantityConfirmed" BOOLEAN NOT NULL DEFAULT false,
 "quantityEvidence" TEXT NOT NULL, "approvalEvidence" TEXT NOT NULL, "priceJson" JSONB, "isActive" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (NOT "quantityConfirmed" OR "quantity" IS NOT NULL)
);
CREATE INDEX "BoqWorkScope_planId_isActive_idx" ON "BoqWorkScope"("planId","isActive");
CREATE TABLE "BoqWorkBinding" (
 "id" SERIAL PRIMARY KEY, "projectId" INTEGER NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "planId" INTEGER NOT NULL REFERENCES "BoqWorkPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "signedRevisionId" INTEGER NOT NULL REFERENCES "BoqBillRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "lineKey" TEXT NOT NULL, "sourceKind" TEXT NOT NULL, "sourceHash" VARCHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BoqWorkBinding_signedRevisionId_lineKey_key" ON "BoqWorkBinding"("signedRevisionId","lineKey");
CREATE INDEX "BoqWorkBinding_planId_idx" ON "BoqWorkBinding"("planId");
CREATE TABLE "BoqWorkAllocation" (
 "id" SERIAL PRIMARY KEY, "bindingId" INTEGER NOT NULL REFERENCES "BoqWorkBinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "scopeId" UUID NOT NULL REFERENCES "BoqWorkScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "deltaQuantity" DECIMAL(38,18) NOT NULL, "planVersion" INTEGER NOT NULL CHECK ("planVersion">0),
 "reversesId" INTEGER REFERENCES "BoqWorkAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "reason" TEXT NOT NULL,
 "createdById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BoqWorkAllocation_bindingId_scopeId_idx" ON "BoqWorkAllocation"("bindingId","scopeId");
CREATE TABLE "BoqWorkEvent" (
 "id" SERIAL PRIMARY KEY, "planId" INTEGER NOT NULL REFERENCES "BoqWorkPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "version" INTEGER NOT NULL CHECK ("version">0), "kind" TEXT NOT NULL, "beforeJson" JSONB, "afterJson" JSONB NOT NULL,
 "actorId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "reason" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BoqWorkEvent_planId_version_key" ON "BoqWorkEvent"("planId","version");
CREATE FUNCTION "boq_work_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'BoQ work audit and allocation records are append-only'; END;
$$;
CREATE TRIGGER "BoqWorkEvent_append_only" BEFORE UPDATE OR DELETE ON "BoqWorkEvent" FOR EACH ROW EXECUTE FUNCTION "boq_work_append_only"();
CREATE TRIGGER "BoqWorkAllocation_append_only" BEFORE UPDATE OR DELETE ON "BoqWorkAllocation" FOR EACH ROW EXECUTE FUNCTION "boq_work_append_only"();
