-- Drop foreign key and column if exists
ALTER TABLE "User" DROP COLUMN IF EXISTS "positionId";

-- Drop Position table if exists
DROP TABLE IF EXISTS "Position";
