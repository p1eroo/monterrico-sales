-- Metas diarias de actividades (dashboard operativo).
CREATE TABLE "CrmUserDailyActivityTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayStart" DATE NOT NULL,
    "contactoTarget" INTEGER NOT NULL DEFAULT 0,
    "noContactoTarget" INTEGER NOT NULL DEFAULT 0,
    "reunionesTarget" INTEGER NOT NULL DEFAULT 0,
    "correosTarget" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmUserDailyActivityTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmUserDailyActivityTarget_userId_dayStart_key" ON "CrmUserDailyActivityTarget"("userId", "dayStart");
CREATE INDEX "CrmUserDailyActivityTarget_dayStart_idx" ON "CrmUserDailyActivityTarget"("dayStart");

ALTER TABLE "CrmUserDailyActivityTarget" ADD CONSTRAINT "CrmUserDailyActivityTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
