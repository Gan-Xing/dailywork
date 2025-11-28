-- Expand inspection status lifecycle with appointment and submission stages
ALTER TYPE "InspectionStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "InspectionStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
