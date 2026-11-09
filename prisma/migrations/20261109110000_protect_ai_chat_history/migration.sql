ALTER TABLE "AiChatMessage"
  ADD COLUMN "requiredPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "requiresAdmin" BOOLEAN NOT NULL DEFAULT false;
