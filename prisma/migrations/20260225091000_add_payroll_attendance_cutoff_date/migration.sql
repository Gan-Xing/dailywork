-- Add attendance cutoff date to payroll runs
ALTER TABLE "PayrollRun" ADD COLUMN "attendanceCutoffDate" TIMESTAMP(3);

UPDATE "PayrollRun"
SET "attendanceCutoffDate" = "payoutDate"
WHERE "attendanceCutoffDate" IS NULL;

ALTER TABLE "PayrollRun" ALTER COLUMN "attendanceCutoffDate" SET NOT NULL;
