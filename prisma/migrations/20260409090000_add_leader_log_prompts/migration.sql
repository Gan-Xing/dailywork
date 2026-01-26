CREATE TABLE "LeaderLogPrompt" (
  "id" SERIAL NOT NULL,
  "supervisorId" INTEGER NOT NULL,
  "promptText" TEXT NOT NULL,
  "updatedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeaderLogPrompt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaderLogPrompt_supervisorId_key" ON "LeaderLogPrompt"("supervisorId");
CREATE INDEX "LeaderLogPrompt_updatedById_idx" ON "LeaderLogPrompt"("updatedById");

ALTER TABLE "LeaderLogPrompt"
  ADD CONSTRAINT "LeaderLogPrompt_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaderLogPrompt"
  ADD CONSTRAINT "LeaderLogPrompt_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
