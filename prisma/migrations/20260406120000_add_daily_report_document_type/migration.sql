DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'DocumentType'
      AND pg_enum.enumlabel = 'DAILY_REPORT'
  ) THEN
    ALTER TYPE "DocumentType" ADD VALUE 'DAILY_REPORT';
  END IF;
END $$;
