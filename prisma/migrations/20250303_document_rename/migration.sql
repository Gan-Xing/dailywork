-- Rename Submission -> Document, SubmissionTemplate -> DocumentTemplate
-- Rename enum SubmissionStatus -> DocumentStatus
-- Rename InspectionEntry.submissionId -> documentId
-- Drop renderedHtml column (no longer stored)

-- 1) Drop FKs that reference renamed tables/columns
ALTER TABLE "InspectionEntry" DROP CONSTRAINT IF EXISTS "InspectionEntry_submissionId_fkey";
ALTER TABLE "Submission" DROP CONSTRAINT IF EXISTS "Submission_templateId_fkey";
ALTER TABLE "Submission" DROP CONSTRAINT IF EXISTS "Submission_createdById_fkey";
ALTER TABLE "Submission" DROP CONSTRAINT IF EXISTS "Submission_updatedById_fkey";
ALTER TABLE "SubmissionTemplate" DROP CONSTRAINT IF EXISTS "SubmissionTemplate_createdById_fkey";
ALTER TABLE "SubmissionTemplate" DROP CONSTRAINT IF EXISTS "SubmissionTemplate_updatedById_fkey";

-- 2) Rename enum SubmissionStatus -> DocumentStatus
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubmissionStatus') THEN
    ALTER TYPE "SubmissionStatus" RENAME TO "DocumentStatus";
  END IF;
END$$;

-- 3) Rename tables
ALTER TABLE "Submission" RENAME TO "Document";
ALTER TABLE "SubmissionTemplate" RENAME TO "DocumentTemplate";

-- 4) Rename column in InspectionEntry
ALTER TABLE "InspectionEntry" RENAME COLUMN "submissionId" TO "documentId";

-- 5) Drop unused column renderedHtml
ALTER TABLE "Document" DROP COLUMN IF EXISTS "renderedHtml";

-- 6) Rename indexes to match new table names
ALTER INDEX IF EXISTS "Submission_type_status_idx" RENAME TO "Document_type_status_idx";
ALTER INDEX IF EXISTS "Submission_createdAt_idx" RENAME TO "Document_createdAt_idx";
ALTER INDEX IF EXISTS "Submission_updatedAt_idx" RENAME TO "Document_updatedAt_idx";
ALTER INDEX IF EXISTS "SubmissionTemplate_type_status_idx" RENAME TO "DocumentTemplate_type_status_idx";
ALTER INDEX IF EXISTS "SubmissionTemplate_name_idx" RENAME TO "DocumentTemplate_name_idx";

-- 7) Recreate FKs with new names/targets
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentTemplate"
  ADD CONSTRAINT "DocumentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentTemplate"
  ADD CONSTRAINT "DocumentTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspectionEntry"
  ADD CONSTRAINT "InspectionEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE;
