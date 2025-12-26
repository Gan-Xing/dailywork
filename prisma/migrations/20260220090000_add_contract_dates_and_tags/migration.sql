-- Add tags to users
ALTER TABLE "User"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Add contract dates to expat profiles
ALTER TABLE "UserExpatProfile"
ADD COLUMN "contractStartDate" TIMESTAMP(3),
ADD COLUMN "contractEndDate" TIMESTAMP(3);

-- Backfill contract dates for non-Chinese members when joinDate exists
UPDATE "UserExpatProfile" AS exp
SET
  "contractStartDate" = u."joinDate",
  "contractEndDate" = u."joinDate" + INTERVAL '1 year'
FROM "User" AS u
WHERE
  exp."userId" = u."id"
  AND u."nationality" IS DISTINCT FROM 'china'
  AND u."joinDate" IS NOT NULL
  AND exp."contractStartDate" IS NULL
  AND exp."contractEndDate" IS NULL;
