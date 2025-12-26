-- CreateTable
CREATE TABLE "UserContractChange" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "chineseSupervisorId" INTEGER,
    "chineseSupervisorName" TEXT,
    "contractNumber" TEXT,
    "contractType" "ContractType",
    "salaryCategory" TEXT,
    "salaryAmount" DECIMAL(18,2),
    "salaryUnit" "SalaryUnit",
    "prime" DECIMAL(18,2),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "changeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserContractChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPayrollChange" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "team" TEXT,
    "chineseSupervisorId" INTEGER,
    "chineseSupervisorName" TEXT,
    "salaryCategory" TEXT,
    "salaryAmount" DECIMAL(18,2),
    "salaryUnit" "SalaryUnit",
    "prime" DECIMAL(18,2),
    "baseSalaryAmount" DECIMAL(18,2),
    "baseSalaryUnit" "SalaryUnit",
    "netMonthlyAmount" DECIMAL(18,2),
    "netMonthlyUnit" "SalaryUnit",
    "changeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPayrollChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPayrollPayout" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "team" TEXT,
    "chineseSupervisorId" INTEGER,
    "chineseSupervisorName" TEXT,
    "payoutDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPayrollPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserContractChange_userId_idx" ON "UserContractChange"("userId");

-- CreateIndex
CREATE INDEX "UserContractChange_changeDate_idx" ON "UserContractChange"("changeDate");

-- CreateIndex
CREATE INDEX "UserPayrollChange_userId_idx" ON "UserPayrollChange"("userId");

-- CreateIndex
CREATE INDEX "UserPayrollChange_changeDate_idx" ON "UserPayrollChange"("changeDate");

-- CreateIndex
CREATE INDEX "UserPayrollPayout_userId_idx" ON "UserPayrollPayout"("userId");

-- CreateIndex
CREATE INDEX "UserPayrollPayout_payoutDate_idx" ON "UserPayrollPayout"("payoutDate");

-- AddForeignKey
ALTER TABLE "UserContractChange" ADD CONSTRAINT "UserContractChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContractChange" ADD CONSTRAINT "UserContractChange_chineseSupervisorId_fkey" FOREIGN KEY ("chineseSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPayrollChange" ADD CONSTRAINT "UserPayrollChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPayrollChange" ADD CONSTRAINT "UserPayrollChange_chineseSupervisorId_fkey" FOREIGN KEY ("chineseSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPayrollPayout" ADD CONSTRAINT "UserPayrollPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPayrollPayout" ADD CONSTRAINT "UserPayrollPayout_chineseSupervisorId_fkey" FOREIGN KEY ("chineseSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
