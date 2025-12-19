-- Adds document enums, SubmissionTemplate, and extends Submission without dropping existing data.
-- Safe for existing data: new columns are nullable or have defaults; type/status defaults backfill existing rows.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
    CREATE TYPE "DocumentType" AS ENUM ('SUBMISSION', 'LETTER', 'MINUTES', 'SUPPLY_REQUEST');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TemplateStatus') THEN
    CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubmissionStatus') THEN
    CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'FINAL', 'ARCHIVED');
  END IF;
END$$;

-- Extend Submission with optional template/data fields and audit links.
ALTER TABLE "Submission"
  ADD COLUMN IF NOT EXISTS "type" "DocumentType" NOT NULL DEFAULT 'SUBMISSION',
  ADD COLUMN IF NOT EXISTS "templateId" TEXT,
  ADD COLUMN IF NOT EXISTS "templateVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "data" JSONB,
  ADD COLUMN IF NOT EXISTS "renderedHtml" TEXT,
  ADD COLUMN IF NOT EXISTS "createdById" INTEGER,
  ADD COLUMN IF NOT EXISTS "updatedById" INTEGER;

-- Backfill defaults for existing rows (in case columns were added nullable by a prior run).
UPDATE "Submission" SET "type" = 'SUBMISSION' WHERE "type" IS NULL;
UPDATE "Submission" SET "status" = 'DRAFT' WHERE "status" IS NULL;

-- SubmissionTemplate table for HTML templates and placeholder metadata.
CREATE TABLE IF NOT EXISTS "SubmissionTemplate" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" "DocumentType" NOT NULL DEFAULT 'SUBMISSION',
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "language" TEXT NOT NULL DEFAULT 'fr',
  "html" TEXT NOT NULL,
  "placeholders" JSONB NOT NULL,
  "createdById" INTEGER,
  "updatedById" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relations
ALTER TABLE "SubmissionTemplate"
  ADD CONSTRAINT "SubmissionTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubmissionTemplate"
  ADD CONSTRAINT "SubmissionTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SubmissionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes to speed up filtering.
CREATE INDEX IF NOT EXISTS "Submission_type_status_idx" ON "Submission" ("type", "status");
CREATE INDEX IF NOT EXISTS "Submission_createdAt_idx" ON "Submission" ("createdAt");
CREATE INDEX IF NOT EXISTS "Submission_updatedAt_idx" ON "Submission" ("updatedAt");
CREATE INDEX IF NOT EXISTS "SubmissionTemplate_type_status_idx" ON "SubmissionTemplate" ("type", "status");
CREATE INDEX IF NOT EXISTS "SubmissionTemplate_name_idx" ON "SubmissionTemplate" ("name");
