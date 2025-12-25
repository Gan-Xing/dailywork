-- Add prime bonus field to expat profile
ALTER TABLE "UserExpatProfile"
ADD COLUMN "prime" DECIMAL(18,2);
