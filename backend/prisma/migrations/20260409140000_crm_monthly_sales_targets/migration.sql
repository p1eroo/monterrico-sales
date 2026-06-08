-- CreateTable
CREATE TABLE "CrmMonthlySalesTarget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT 'default',
    "periodStart" DATE NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmMonthlySalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmMonthlySalesTarget_organizationId_periodStart_idx" ON "CrmMonthlySalesTarget"("organizationId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "CrmMonthlySalesTarget_organizationId_periodStart_key" ON "CrmMonthlySalesTarget"("organizationId", "periodStart");

-- AddForeignKey
ALTER TABLE "CrmMonthlySalesTarget" ADD CONSTRAINT "CrmMonthlySalesTarget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "CrmOrganizationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
