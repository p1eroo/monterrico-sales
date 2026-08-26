-- CreateTable
CREATE TABLE "WhatsAppCloudAccount" (
    "id" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayPhoneNumber" TEXT,
    "verifiedName" TEXT,
    "accessToken" TEXT NOT NULL,
    "graphApiVersion" TEXT NOT NULL DEFAULT 'v22.0',
    "connectedById" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppCloudAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppCloudTemplate" (
    "id" TEXT NOT NULL,
    "metaTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "header" TEXT,
    "body" TEXT NOT NULL,
    "footer" TEXT,
    "headerMedia" TEXT,
    "parameterFormat" TEXT,
    "sampleVariables" JSONB,
    "qualityRating" TEXT,
    "rejectionReason" TEXT,
    "buttons" JSONB,
    "components" JSONB,
    "accountId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppCloudTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppBulkCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "accountId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "variableMapping" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppBulkCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppBulkRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metaMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppBulkRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppCloudAccount_wabaId_key" ON "WhatsAppCloudAccount"("wabaId");

-- CreateIndex
CREATE INDEX "WhatsAppCloudAccount_connectedById_idx" ON "WhatsAppCloudAccount"("connectedById");

-- CreateIndex
CREATE INDEX "WhatsAppCloudAccount_active_idx" ON "WhatsAppCloudAccount"("active");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppCloudTemplate_metaTemplateId_key" ON "WhatsAppCloudTemplate"("metaTemplateId");

-- CreateIndex
CREATE INDEX "WhatsAppCloudTemplate_accountId_status_idx" ON "WhatsAppCloudTemplate"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppCloudTemplate_accountId_name_language_key" ON "WhatsAppCloudTemplate"("accountId", "name", "language");

-- CreateIndex
CREATE INDEX "WhatsAppBulkCampaign_accountId_createdAt_idx" ON "WhatsAppBulkCampaign"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppBulkCampaign_status_idx" ON "WhatsAppBulkCampaign"("status");

-- CreateIndex
CREATE INDEX "WhatsAppBulkRecipient_campaignId_status_idx" ON "WhatsAppBulkRecipient"("campaignId", "status");

-- AddForeignKey
ALTER TABLE "WhatsAppCloudAccount" ADD CONSTRAINT "WhatsAppCloudAccount_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppCloudTemplate" ADD CONSTRAINT "WhatsAppCloudTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppCloudAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBulkCampaign" ADD CONSTRAINT "WhatsAppBulkCampaign_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppCloudAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBulkCampaign" ADD CONSTRAINT "WhatsAppBulkCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppCloudTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBulkRecipient" ADD CONSTRAINT "WhatsAppBulkRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WhatsAppBulkCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
