CREATE TABLE "AiChatSession" (
  "id" UUID NOT NULL, "userId" INTEGER NOT NULL, "summary" TEXT NOT NULL,
  "summarySource" TEXT NOT NULL DEFAULT 'auto', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AiChatSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AiChatSession_userId_updatedAt_idx" ON "AiChatSession"("userId", "updatedAt");
CREATE TABLE "AiChatMessage" (
  "id" SERIAL NOT NULL, "sessionId" UUID NOT NULL, "clientKey" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('user', 'assistant')), "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AiChatMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiChatMessage_sessionId_clientKey_key" ON "AiChatMessage"("sessionId", "clientKey");
CREATE INDEX "AiChatMessage_sessionId_createdAt_id_idx" ON "AiChatMessage"("sessionId", "createdAt", "id");
CREATE TABLE "AiChatMemory" (
  "id" UUID NOT NULL, "userId" INTEGER NOT NULL, "scopeType" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL, "title" TEXT NOT NULL, "content" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiChatMemory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiChatMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiChatMemory_userId_scopeType_scopeKey_key" ON "AiChatMemory"("userId", "scopeType", "scopeKey");
CREATE TABLE "AiChatJob" (
  "id" UUID NOT NULL, "userId" INTEGER NOT NULL, "sessionId" UUID, "requestKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('WEEKLY_PLAN_CHANGE', 'WEEKLY_PDF')),
  "status" TEXT NOT NULL, "input" JSONB NOT NULL, "result" JSONB, "error" TEXT,
  "expiresAt" TIMESTAMP(3), "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiChatJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiChatJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiChatJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiChatJob_userId_requestKey_key" ON "AiChatJob"("userId", "requestKey");
CREATE INDEX "AiChatJob_userId_sessionId_createdAt_idx" ON "AiChatJob"("userId", "sessionId", "createdAt");
CREATE INDEX "AiChatJob_status_leaseUntil_createdAt_idx" ON "AiChatJob"("status", "leaseUntil", "createdAt");
