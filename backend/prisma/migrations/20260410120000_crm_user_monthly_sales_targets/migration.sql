-- CreateTable
CREATE TABLE "CrmUserMonthlySalesTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmUserMonthlySalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmUserMonthlySalesTarget_userId_periodStart_idx" ON "CrmUserMonthlySalesTarget"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "CrmUserMonthlySalesTarget_userId_periodStart_key" ON "CrmUserMonthlySalesTarget"("userId", "periodStart");

-- AddForeignKey
ALTER TABLE "CrmUserMonthlySalesTarget" ADD CONSTRAINT "CrmUserMonthlySalesTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
