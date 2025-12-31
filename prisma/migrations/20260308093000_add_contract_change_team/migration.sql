-- Add team snapshot to contract change history
ALTER TABLE "UserContractChange" ADD COLUMN "team" TEXT;
