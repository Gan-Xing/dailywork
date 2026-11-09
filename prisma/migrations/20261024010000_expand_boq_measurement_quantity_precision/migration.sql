-- Preserve measured quantities such as 3.185 m3 without changing currency precision.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "BoqMeasurement" ALTER COLUMN "quantity" TYPE DECIMAL(38,18);
ALTER TABLE "BoqMeasurementDetail" ALTER COLUMN "quantity" TYPE DECIMAL(38,18);
COMMIT;
