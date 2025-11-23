-- Add slug column
ALTER TABLE "RoadSection" ADD COLUMN "slug" TEXT;

-- Populate slug from name (letters/numbers/hyphen)
UPDATE "RoadSection"
SET "slug" = NULLIF(regexp_replace(lower(coalesce("name", '')), '[^a-z0-9]+', '-', 'g'), '');

-- Fallback to road-<id> when empty
UPDATE "RoadSection"
SET "slug" = 'road-' || "id"
WHERE "slug" IS NULL OR "slug" = '';

-- Resolve duplicates by appending id
WITH dupes AS (
  SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM "RoadSection"
)
UPDATE "RoadSection" r
SET slug = r.slug || '-' || r.id
FROM dupes d
WHERE r.id = d.id
  AND d.rn > 1;

-- Enforce uniqueness and not null
ALTER TABLE "RoadSection" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "RoadSection_slug_key" ON "RoadSection"("slug");
