-- AlterTable
ALTER TABLE "WeeklyDeliveryPlan"
ADD COLUMN "approverUserId" INTEGER,
ADD COLUMN "editorUserId" INTEGER;

-- Backfill unique exact matches from existing signer snapshots.
WITH approver_candidates AS (
  SELECT
    plan."id" AS plan_id,
    user_record."id" AS user_id
  FROM "WeeklyDeliveryPlan" AS plan
  JOIN "User" AS user_record
    ON user_record."nationality" = 'china'
  LEFT JOIN "UserChineseProfile" AS chinese_profile
    ON chinese_profile."userId" = user_record."id"
  WHERE
    plan."approverName" IS NOT NULL
    AND BTRIM(plan."approverName") <> ''
    AND (
      LOWER(BTRIM(user_record."name")) = LOWER(BTRIM(plan."approverName"))
      OR LOWER(BTRIM(user_record."username")) = LOWER(BTRIM(plan."approverName"))
      OR LOWER(BTRIM(COALESCE(chinese_profile."frenchName", ''))) = LOWER(BTRIM(plan."approverName"))
    )
),
approver_unique AS (
  SELECT
    plan_id,
    MIN(user_id) AS user_id
  FROM approver_candidates
  GROUP BY plan_id
  HAVING COUNT(*) = 1
)
UPDATE "WeeklyDeliveryPlan" AS plan
SET "approverUserId" = approver_unique.user_id
FROM approver_unique
WHERE
  plan."id" = approver_unique.plan_id
  AND plan."approverUserId" IS NULL;

WITH editor_candidates AS (
  SELECT
    plan."id" AS plan_id,
    user_record."id" AS user_id
  FROM "WeeklyDeliveryPlan" AS plan
  JOIN "User" AS user_record
    ON user_record."nationality" = 'china'
  LEFT JOIN "UserChineseProfile" AS chinese_profile
    ON chinese_profile."userId" = user_record."id"
  WHERE
    plan."editorName" IS NOT NULL
    AND BTRIM(plan."editorName") <> ''
    AND (
      LOWER(BTRIM(user_record."name")) = LOWER(BTRIM(plan."editorName"))
      OR LOWER(BTRIM(user_record."username")) = LOWER(BTRIM(plan."editorName"))
      OR LOWER(BTRIM(COALESCE(chinese_profile."frenchName", ''))) = LOWER(BTRIM(plan."editorName"))
    )
),
editor_unique AS (
  SELECT
    plan_id,
    MIN(user_id) AS user_id
  FROM editor_candidates
  GROUP BY plan_id
  HAVING COUNT(*) = 1
)
UPDATE "WeeklyDeliveryPlan" AS plan
SET "editorUserId" = editor_unique.user_id
FROM editor_unique
WHERE
  plan."id" = editor_unique.plan_id
  AND plan."editorUserId" IS NULL;

-- CreateIndex
CREATE INDEX "WeeklyDeliveryPlan_approverUserId_idx" ON "WeeklyDeliveryPlan"("approverUserId");

-- CreateIndex
CREATE INDEX "WeeklyDeliveryPlan_editorUserId_idx" ON "WeeklyDeliveryPlan"("editorUserId");

-- AddForeignKey
ALTER TABLE "WeeklyDeliveryPlan"
ADD CONSTRAINT "WeeklyDeliveryPlan_approverUserId_fkey"
FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyDeliveryPlan"
ADD CONSTRAINT "WeeklyDeliveryPlan_editorUserId_fkey"
FOREIGN KEY ("editorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
