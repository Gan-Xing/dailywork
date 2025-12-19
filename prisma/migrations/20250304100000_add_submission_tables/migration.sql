-- Create submission head table (1:1 with Document)
CREATE TABLE IF NOT EXISTS "Submission" (
  "documentId" INTEGER PRIMARY KEY,
  "projectName" TEXT NOT NULL,
  "projectCode" TEXT NOT NULL,
  "contractNumbers" JSONB NOT NULL,
  "bordereauNumber" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "senderOrg" TEXT NOT NULL,
  "senderDate" TEXT NOT NULL,
  "senderLastName" TEXT NOT NULL,
  "senderFirstName" TEXT NOT NULL,
  "senderSignature" TEXT,
  "senderTime" TEXT,
  "recipientOrg" TEXT NOT NULL,
  "recipientDate" TEXT NOT NULL,
  "recipientLastName" TEXT NOT NULL,
  "recipientFirstName" TEXT NOT NULL,
  "recipientSignature" TEXT,
  "recipientTime" TEXT,
  "comments" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Create submission detail rows table
CREATE TABLE IF NOT EXISTS "SubmissionItem" (
  "id" SERIAL PRIMARY KEY,
  "documentId" INTEGER NOT NULL,
  "order" INTEGER,
  "designation" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION,
  "observation" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "SubmissionItem"
  ADD CONSTRAINT "SubmissionItem_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "SubmissionItem_document_order_idx"
  ON "SubmissionItem" ("documentId", "order");
