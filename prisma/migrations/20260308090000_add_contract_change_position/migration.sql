-- Add position snapshot to contract change history
ALTER TABLE "UserContractChange" ADD COLUMN "position" TEXT;
