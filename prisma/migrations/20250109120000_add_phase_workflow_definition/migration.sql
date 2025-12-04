-- CreateTable
CREATE TABLE "PhaseWorkflowDefinition" (
    "id" SERIAL NOT NULL,
    "phaseDefinitionId" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhaseWorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhaseWorkflowDefinition_phaseDefinitionId_key" ON "PhaseWorkflowDefinition"("phaseDefinitionId");

-- AddForeignKey
ALTER TABLE "PhaseWorkflowDefinition" ADD CONSTRAINT "PhaseWorkflowDefinition_phaseDefinitionId_fkey" FOREIGN KEY ("phaseDefinitionId") REFERENCES "PhaseDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
