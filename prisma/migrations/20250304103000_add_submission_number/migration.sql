-- Add submissionNumber to Submission (unique per submission)
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "submissionNumber" INTEGER;

-- Backfill existing rows if needed (set to incremental based on documentId order)
DO $$
DECLARE
  rec RECORD;
  i INTEGER := 1;
BEGIN
  FOR rec IN SELECT "documentId" FROM "Submission" WHERE "submissionNumber" IS NULL ORDER BY "documentId" LOOP
    UPDATE "Submission" SET "submissionNumber" = i WHERE "documentId" = rec."documentId";
    i := i + 1;
  END LOOP;
END$$;

ALTER TABLE "Submission" ALTER COLUMN "submissionNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Submission_submissionNumber_key" ON "Submission"("submissionNumber");
