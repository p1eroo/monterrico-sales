-- CreateTable
CREATE TABLE "CrmOrganizationProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT 'Taxi Monterrico',
    "description" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "globalWeeklyGoal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "globalMonthlyGoal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmOrganizationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLeadSource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CrmLeadSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmPipelineStage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "probability" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CrmPipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmPriority" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CrmPriority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmActivityType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CrmActivityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmUserSalesGoal" (
    "userId" TEXT NOT NULL,
    "weeklyTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "CrmUserSalesGoal_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmLeadSource_slug_key" ON "CrmLeadSource"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CrmPipelineStage_slug_key" ON "CrmPipelineStage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CrmPriority_slug_key" ON "CrmPriority"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CrmActivityType_slug_key" ON "CrmActivityType"("slug");

-- AddForeignKey
ALTER TABLE "CrmUserSalesGoal" ADD CONSTRAINT "CrmUserSalesGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
