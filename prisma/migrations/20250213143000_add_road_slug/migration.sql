-- Add slug column
ALTER TABLE "RoadSection" ADD COLUMN "slug" TEXT;

-- Populate slug from name (letters/numbers/hyphen), fallback to road-<id>
UPDATE "RoadSection"
SET "slug" = NULLIF(regexp_replace(lower(coalesce("name", '')), '[^a-z0-9]+', '-', 'g'), '');

UPDATE "RoadSection"
SET "slug" = 'road-' || "id"
WHERE "slug" IS NULL;

-- Enforce uniqueness and not null
ALTER TABLE "RoadSection" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "RoadSection_slug_key" ON "RoadSection"("slug");
