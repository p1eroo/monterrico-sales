-- Meta diaria persistente: una fila por asesor (antes por userId + dayStart).
CREATE TEMP TABLE "_crm_daily_target_dedup" AS
SELECT DISTINCT ON ("userId")
    "id",
    "userId",
    "contactoTarget",
    "noContactoTarget",
    "reunionesTarget",
    "correosTarget",
    "createdAt",
    "updatedAt"
FROM "CrmUserDailyActivityTarget"
ORDER BY "userId", "dayStart" DESC, "updatedAt" DESC;

DELETE FROM "CrmUserDailyActivityTarget";

DROP INDEX IF EXISTS "CrmUserDailyActivityTarget_userId_dayStart_key";
DROP INDEX IF EXISTS "CrmUserDailyActivityTarget_dayStart_idx";

ALTER TABLE "CrmUserDailyActivityTarget" DROP COLUMN "dayStart";

INSERT INTO "CrmUserDailyActivityTarget" (
    "id",
    "userId",
    "contactoTarget",
    "noContactoTarget",
    "reunionesTarget",
    "correosTarget",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "userId",
    "contactoTarget",
    "noContactoTarget",
    "reunionesTarget",
    "correosTarget",
    "createdAt",
    "updatedAt"
FROM "_crm_daily_target_dedup";

CREATE UNIQUE INDEX "CrmUserDailyActivityTarget_userId_key" ON "CrmUserDailyActivityTarget"("userId");
