-- Metas semanales de actividades por asesor
CREATE TABLE "CrmUserWeeklyActivityTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "contactoTarget" INTEGER NOT NULL DEFAULT 0,
    "noContactoTarget" INTEGER NOT NULL DEFAULT 0,
    "reunionesTarget" INTEGER NOT NULL DEFAULT 0,
    "correosTarget" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmUserWeeklyActivityTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmUserWeeklyActivityTarget_userId_weekStart_key" ON "CrmUserWeeklyActivityTarget"("userId", "weekStart");
CREATE INDEX "CrmUserWeeklyActivityTarget_weekStart_idx" ON "CrmUserWeeklyActivityTarget"("weekStart");

ALTER TABLE "CrmUserWeeklyActivityTarget" ADD CONSTRAINT "CrmUserWeeklyActivityTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
