-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "cycleId" TEXT,
ADD COLUMN     "parentGoalId" TEXT;

-- AlterTable
ALTER TABLE "SubGoal" ADD COLUMN     "currentValue" DOUBLE PRECISION,
ADD COLUMN     "startValue" DOUBLE PRECISION,
ADD COLUMN     "targetValue" DOUBLE PRECISION,
ADD COLUMN     "unit" TEXT;

-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'quarter',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT,
    "progress" INTEGER NOT NULL,
    "confidence" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cycle_organizationId_idx" ON "Cycle"("organizationId");

-- CreateIndex
CREATE INDEX "CheckIn_goalId_createdAt_idx" ON "CheckIn"("goalId", "createdAt");

-- CreateIndex
CREATE INDEX "Goal_parentGoalId_idx" ON "Goal"("parentGoalId");

-- CreateIndex
CREATE INDEX "Goal_cycleId_idx" ON "Goal"("cycleId");

-- AddForeignKey
ALTER TABLE "Cycle" ADD CONSTRAINT "Cycle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_parentGoalId_fkey" FOREIGN KEY ("parentGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
