-- Backfill intervalId for level-crossing inspection entries where a unique phase interval match exists.
-- Ambiguous entries (multiple matching intervals) are intentionally left NULL for manual reconciliation.
WITH candidate_matches AS (
  SELECT
    ie.id AS entry_id,
    pi.id AS interval_id,
    COUNT(*) OVER (PARTITION BY ie.id) AS match_count
  FROM "InspectionEntry" ie
  INNER JOIN "RoadSection" r
    ON r.id = ie."roadId"
   AND r.slug = 'level-crossing'
  INNER JOIN "PhaseInterval" pi
    ON pi."phaseId" = ie."phaseId"
   AND pi.side = ie.side
   AND (
     (pi."startPk" = ie."startPk" AND pi."endPk" = ie."endPk")
     OR
     (pi."startPk" = ie."endPk" AND pi."endPk" = ie."startPk")
   )
   AND COALESCE(pi."locationRoadId", -1) = COALESCE(ie."locationRoadId", -1)
   AND COALESCE(pi."levelCrossingSide"::text, '') = COALESCE(ie."levelCrossingSide"::text, '')
  WHERE ie."intervalId" IS NULL
)
UPDATE "InspectionEntry" ie
SET "intervalId" = cm.interval_id
FROM candidate_matches cm
WHERE ie.id = cm.entry_id
  AND cm.match_count = 1;
