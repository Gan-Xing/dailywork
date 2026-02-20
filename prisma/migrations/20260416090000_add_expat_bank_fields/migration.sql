-- Add bank fields to expat profile
ALTER TABLE "UserExpatProfile"
ADD COLUMN "bankAccountNumber" TEXT,
ADD COLUMN "bankName" TEXT;
