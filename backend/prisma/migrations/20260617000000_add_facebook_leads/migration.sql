-- CreateTable: FacebookAccount
CREATE TABLE "FacebookAccount" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageAccessToken" TEXT NOT NULL,
    "pageTokenExpiresAt" TIMESTAMP(3),
    "instagramId" TEXT,
    "connectedById" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FacebookForm
CREATE TABLE "FacebookForm" (
    "id" TEXT NOT NULL,
    "facebookFormId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "locale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "leadsCount" INTEGER NOT NULL DEFAULT 0,
    "lastLeadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FacebookLead
CREATE TABLE "FacebookLead" (
    "id" TEXT NOT NULL,
    "facebookLeadId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "fieldData" JSONB NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "adId" TEXT,
    "adName" TEXT,
    "createdTime" TIMESTAMP(3) NOT NULL,
    "importedAsContactId" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacebookLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacebookAccount_pageId_key" ON "FacebookAccount"("pageId");
CREATE INDEX "FacebookAccount_connectedById_idx" ON "FacebookAccount"("connectedById");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookForm_facebookFormId_key" ON "FacebookForm"("facebookFormId");
CREATE INDEX "FacebookForm_accountId_idx" ON "FacebookForm"("accountId");
CREATE INDEX "FacebookForm_pageId_idx" ON "FacebookForm"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookLead_facebookLeadId_key" ON "FacebookLead"("facebookLeadId");
CREATE INDEX "FacebookLead_formId_idx" ON "FacebookLead"("formId");
CREATE INDEX "FacebookLead_createdTime_idx" ON "FacebookLead"("createdTime");
CREATE INDEX "FacebookLead_importedAsContactId_idx" ON "FacebookLead"("importedAsContactId");
CREATE INDEX "FacebookLead_importedAt_idx" ON "FacebookLead"("importedAt");

-- AddForeignKey
ALTER TABLE "FacebookAccount" ADD CONSTRAINT "FacebookAccount_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookForm" ADD CONSTRAINT "FacebookForm_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FacebookAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookLead" ADD CONSTRAINT "FacebookLead_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FacebookForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
