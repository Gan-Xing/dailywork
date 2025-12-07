-- Add optional submission order number to inspection records
ALTER TABLE "InspectionRequest" ADD COLUMN "submissionOrder" INTEGER;
