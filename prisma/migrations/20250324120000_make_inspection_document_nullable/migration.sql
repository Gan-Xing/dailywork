-- Allow InspectionEntry.documentId to be nullable (binding optional)
ALTER TABLE "InspectionEntry"
  ALTER COLUMN "documentId" DROP NOT NULL;
