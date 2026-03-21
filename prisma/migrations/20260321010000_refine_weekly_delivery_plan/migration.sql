-- AlterTable
ALTER TABLE "WeeklyDeliveryPlan"
ADD COLUMN     "weekStartDate" TIMESTAMP(3),
ADD COLUMN     "weekEndDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WeeklyDeliveryPlanItem"
ADD COLUMN     "goodsNameKey" TEXT,
ADD COLUMN     "modelKey" TEXT,
ADD COLUMN     "tractorPlateNumber" TEXT,
ADD COLUMN     "trailerPlateNumber" TEXT;

-- Backfill existing weekly plan item helpers.
UPDATE "WeeklyDeliveryPlanItem"
SET
  "tractorPlateNumber" = "plateNumber",
  "goodsNameKey" = CASE
    WHEN "goodsName" IS NULL OR btrim("goodsName") = '' THEN NULL
    ELSE lower(regexp_replace(btrim("goodsName"), '[[:space:]]+', ' ', 'g'))
  END,
  "modelKey" = CASE
    WHEN "model" IS NULL THEN ''
    ELSE "model"::text
  END;

-- CreateTable
CREATE TABLE "WeeklyMaterialLatestPrice" (
    "id" SERIAL NOT NULL,
    "goodsName" TEXT NOT NULL,
    "goodsNameKey" TEXT NOT NULL,
    "model" JSONB,
    "modelKey" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "sourceItemId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyMaterialLatestPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMaterialPriceHistory" (
    "id" SERIAL NOT NULL,
    "goodsName" TEXT NOT NULL,
    "goodsNameKey" TEXT NOT NULL,
    "model" JSONB,
    "modelKey" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "sourceItemId" INTEGER,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyMaterialPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyDeliveryPlanItem_goodsNameKey_modelKey_idx" ON "WeeklyDeliveryPlanItem"("goodsNameKey", "modelKey");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMaterialLatestPrice_goodsNameKey_modelKey_key" ON "WeeklyMaterialLatestPrice"("goodsNameKey", "modelKey");

-- CreateIndex
CREATE INDEX "WeeklyMaterialLatestPrice_updatedAt_idx" ON "WeeklyMaterialLatestPrice"("updatedAt");

-- CreateIndex
CREATE INDEX "WeeklyMaterialPriceHistory_goodsNameKey_modelKey_archivedAt_idx" ON "WeeklyMaterialPriceHistory"("goodsNameKey", "modelKey", "archivedAt");

-- Backfill latest and archived prices from existing entered rows.
WITH ranked_prices AS (
  SELECT
    "id",
    "goodsName",
    "goodsNameKey",
    "model",
    COALESCE("modelKey", '') AS "resolvedModelKey",
    "unitPrice",
    "createdAt",
    "updatedAt",
    ROW_NUMBER() OVER (
      PARTITION BY "goodsNameKey", COALESCE("modelKey", '')
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS "priceRank"
  FROM "WeeklyDeliveryPlanItem"
  WHERE "unitPrice" IS NOT NULL
    AND "goodsNameKey" IS NOT NULL
)
INSERT INTO "WeeklyMaterialLatestPrice" (
  "goodsName",
  "goodsNameKey",
  "model",
  "modelKey",
  "unitPrice",
  "sourceItemId",
  "createdAt",
  "updatedAt"
)
SELECT
  "goodsName",
  "goodsNameKey",
  "model",
  "resolvedModelKey",
  "unitPrice",
  "id",
  "createdAt",
  "updatedAt"
FROM ranked_prices
WHERE "priceRank" = 1;

WITH ranked_prices AS (
  SELECT
    "id",
    "goodsName",
    "goodsNameKey",
    "model",
    COALESCE("modelKey", '') AS "resolvedModelKey",
    "unitPrice",
    "createdAt",
    "updatedAt",
    ROW_NUMBER() OVER (
      PARTITION BY "goodsNameKey", COALESCE("modelKey", '')
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS "priceRank"
  FROM "WeeklyDeliveryPlanItem"
  WHERE "unitPrice" IS NOT NULL
    AND "goodsNameKey" IS NOT NULL
)
INSERT INTO "WeeklyMaterialPriceHistory" (
  "goodsName",
  "goodsNameKey",
  "model",
  "modelKey",
  "unitPrice",
  "sourceItemId",
  "archivedAt",
  "createdAt"
)
SELECT
  "goodsName",
  "goodsNameKey",
  "model",
  "resolvedModelKey",
  "unitPrice",
  "id",
  CURRENT_TIMESTAMP,
  "createdAt"
FROM ranked_prices
WHERE "priceRank" > 1;

-- DropColumn
ALTER TABLE "WeeklyDeliveryPlanItem" DROP COLUMN "plateNumber";
