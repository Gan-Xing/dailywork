-- AlterTable
ALTER TABLE "UserPayrollPayout"
ADD COLUMN "contractNumberSnapshot" TEXT;

-- Backfill existing payroll payouts with the contract number active at the run cutoff date.
UPDATE "UserPayrollPayout" AS payout
SET "contractNumberSnapshot" = COALESCE(
  (
    SELECT contract_change."contractNumber"
    FROM "UserContractChange" AS contract_change
    INNER JOIN "PayrollRun" AS payroll_run ON payroll_run."id" = payout."runId"
    WHERE contract_change."userId" = payout."userId"
      AND contract_change."contractNumber" IS NOT NULL
      AND contract_change."startDate" IS NOT NULL
      AND contract_change."startDate" <= payroll_run."attendanceCutoffDate"
      AND (
        contract_change."endDate" IS NULL
        OR contract_change."endDate" >= payroll_run."attendanceCutoffDate"
      )
    ORDER BY contract_change."startDate" DESC, contract_change."id" DESC
    LIMIT 1
  ),
  (
    SELECT contract_change."contractNumber"
    FROM "UserContractChange" AS contract_change
    INNER JOIN "PayrollRun" AS payroll_run ON payroll_run."id" = payout."runId"
    WHERE contract_change."userId" = payout."userId"
      AND contract_change."contractNumber" IS NOT NULL
      AND contract_change."changeDate" <= payroll_run."attendanceCutoffDate"
    ORDER BY contract_change."changeDate" DESC, contract_change."id" DESC
    LIMIT 1
  ),
  (
    SELECT profile."contractNumber"
    FROM "UserExpatProfile" AS profile
    WHERE profile."userId" = payout."userId"
  )
);
