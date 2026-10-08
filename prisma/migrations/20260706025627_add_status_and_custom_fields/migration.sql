-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "statusId" TEXT;

-- CreateTable
CREATE TABLE "StatusLabel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'active',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatusLabel_organizationId_order_idx" ON "StatusLabel"("organizationId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "StatusLabel_organizationId_name_key" ON "StatusLabel"("organizationId", "name");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_projectId_order_idx" ON "CustomFieldDefinition"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_projectId_name_key" ON "CustomFieldDefinition"("projectId", "name");

-- CreateIndex
CREATE INDEX "Goal_projectId_statusId_idx" ON "Goal"("projectId", "statusId");

-- AddForeignKey
ALTER TABLE "StatusLabel" ADD CONSTRAINT "StatusLabel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "StatusLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Backfill: seed the 5 default status labels per organization, then map every
-- existing goal to a label from its project's organization.
-- gen_random_uuid() is core in PG13+ (local PG14, prod PG17). If deploying to a
-- PG<13, prepend: CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ============================================================================
INSERT INTO "StatusLabel" ("id","organizationId","name","color","kind","order","isSystem","createdAt","updatedAt")
SELECT gen_random_uuid(), o."id", v.name, v.color, v.kind, v.ord, v.sys, now(), now()
FROM "Organization" o CROSS JOIN (VALUES
  ('시작 전','#94a3b8','active',0,true),
  ('진행 중','#3b82f6','active',1,true),
  ('위험','#ef4444','active',2,false),
  ('보류','#f59e0b','on_hold',3,true),
  ('완료','#22c55e','done',4,true)
) AS v(name,color,kind,ord,sys)
ON CONFLICT ("organizationId","name") DO NOTHING;

UPDATE "Goal" g SET "statusId" = sl."id"
FROM "Project" p, "StatusLabel" sl
WHERE p."id" = g."projectId"
  AND sl."organizationId" = p."organizationId"
  AND sl."name" = CASE
    WHEN g."completed" THEN '완료'
    WHEN g."onHold"    THEN '보류'
    WHEN g."progress" > 0 THEN '진행 중'
    ELSE '시작 전'
  END;
