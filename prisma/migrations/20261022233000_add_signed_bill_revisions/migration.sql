CREATE TYPE "BoqBillRevisionStatus" AS ENUM ('DRAFT', 'SIGNED');

CREATE TABLE "BoqBillRevision" (
  "id" SERIAL NOT NULL,
  "projectId" INTEGER NOT NULL,
  "periodIndex" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" "BoqBillRevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "signedAt" DATE,
  "signedPdfFileId" INTEGER,
  "calculationFileId" INTEGER,
  "grossHt" DECIMAL(30,10),
  "netHt" DECIMAL(30,10),
  "vatAmount" DECIMAL(30,10),
  "netTtc" DECIMAL(30,10),
  "linesJson" JSONB NOT NULL,
  "adjustmentsJson" JSONB NOT NULL,
  "summaryJson" JSONB NOT NULL,
  "sourceJson" JSONB NOT NULL,
  "contentSha256" VARCHAR(64) NOT NULL,
  "changeReason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" INTEGER NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" INTEGER,
  "activatedAt" TIMESTAMP(3),
  "activatedById" INTEGER,
  CONSTRAINT "BoqBillRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BoqBillRevision_positive_period_revision" CHECK ("periodIndex" BETWEEN 1 AND 10000 AND "revision" > 0),
  CONSTRAINT "BoqBillRevision_current_signed" CHECK (NOT "isCurrent" OR "status" = 'SIGNED'),
  CONSTRAINT "BoqBillRevision_signed_evidence" CHECK (
    "status" <> 'SIGNED' OR (
      "signedPdfFileId" IS NOT NULL AND "grossHt" IS NOT NULL AND "netHt" IS NOT NULL
      AND "vatAmount" IS NOT NULL AND "netTtc" IS NOT NULL
      AND "verifiedAt" IS NOT NULL AND "verifiedById" IS NOT NULL
    )
  ),
  CONSTRAINT "BoqBillRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BoqBillRevision_signedPdfFileId_fkey" FOREIGN KEY ("signedPdfFileId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BoqBillRevision_calculationFileId_fkey" FOREIGN KEY ("calculationFileId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BoqBillRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BoqBillRevision_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BoqBillRevision_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BoqBillRevision_projectId_periodIndex_revision_key" ON "BoqBillRevision"("projectId", "periodIndex", "revision");
CREATE UNIQUE INDEX "BoqBillRevision_projectId_periodIndex_contentSha256_key" ON "BoqBillRevision"("projectId", "periodIndex", "contentSha256");
CREATE UNIQUE INDEX "BoqBillRevision_one_current_per_period" ON "BoqBillRevision"("projectId", "periodIndex") WHERE "isCurrent";
CREATE INDEX "BoqBillRevision_projectId_periodIndex_isCurrent_idx" ON "BoqBillRevision"("projectId", "periodIndex", "isCurrent");

CREATE TABLE "BoqBillRevisionEvent" (
  "id" SERIAL NOT NULL,
  "revisionId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "actorId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoqBillRevisionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BoqBillRevisionEvent_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "BoqBillRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BoqBillRevisionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BoqBillRevisionEvent_revisionId_createdAt_idx" ON "BoqBillRevisionEvent"("revisionId", "createdAt");

-- Frozen source values cannot be edited or deleted, including by a future write path.
-- Selection metadata changes only when choosing an existing SIGNED revision.
CREATE FUNCTION "enforce_boq_bill_revision_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Signed bill revisions cannot be deleted; create a new revision';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['isCurrent','activatedAt','activatedById']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['isCurrent','activatedAt','activatedById']) THEN
    RAISE EXCEPTION 'Signed bill document content is immutable; create a new revision';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "BoqBillRevision_immutable" BEFORE UPDATE OR DELETE ON "BoqBillRevision"
  FOR EACH ROW EXECUTE FUNCTION "enforce_boq_bill_revision_immutable"();

CREATE FUNCTION "enforce_boq_bill_event_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Signed bill audit events are append-only';
END;
$$;
CREATE TRIGGER "BoqBillRevisionEvent_append_only" BEFORE UPDATE OR DELETE ON "BoqBillRevisionEvent"
  FOR EACH ROW EXECUTE FUNCTION "enforce_boq_bill_event_append_only"();
