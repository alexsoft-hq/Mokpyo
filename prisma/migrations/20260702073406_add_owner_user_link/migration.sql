-- AlterTable
ALTER TABLE "GoalOwner" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "SubGoalOwner" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "GoalOwner_userId_idx" ON "GoalOwner"("userId");

-- CreateIndex
CREATE INDEX "SubGoalOwner_userId_idx" ON "SubGoalOwner"("userId");

-- AddForeignKey
ALTER TABLE "GoalOwner" ADD CONSTRAINT "GoalOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubGoalOwner" ADD CONSTRAINT "SubGoalOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: 기존 담당자 문자열(ownerName)을 같은 조직 멤버의 User와 이름 정확일치로 연결.
-- 매칭 안 되는 이름(게스트·오타·퇴사자)은 userId NULL로 유지된다.
UPDATE "GoalOwner" go_
SET "userId" = om."userId"
FROM "Goal" g
JOIN "Project" p ON p."id" = g."projectId"
JOIN "OrganizationMember" om ON om."organizationId" = p."organizationId"
JOIN "User" u ON u."id" = om."userId"
WHERE go_."goalId" = g."id" AND u."name" = go_."ownerName" AND go_."userId" IS NULL;

UPDATE "SubGoalOwner" sgo
SET "userId" = om."userId"
FROM "SubGoal" sg
JOIN "Goal" g ON g."id" = sg."goalId"
JOIN "Project" p ON p."id" = g."projectId"
JOIN "OrganizationMember" om ON om."organizationId" = p."organizationId"
JOIN "User" u ON u."id" = om."userId"
WHERE sgo."subGoalId" = sg."id" AND u."name" = sgo."ownerName" AND sgo."userId" IS NULL;
