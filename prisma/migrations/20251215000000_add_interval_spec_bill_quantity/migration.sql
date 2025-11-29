-- Add specification and bill quantity fields to phase intervals
ALTER TABLE "PhaseInterval"
ADD COLUMN "spec" TEXT,
ADD COLUMN "billQuantity" DOUBLE PRECISION;
