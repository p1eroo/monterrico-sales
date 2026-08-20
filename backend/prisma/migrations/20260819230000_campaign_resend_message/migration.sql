-- CreateTable
CREATE TABLE "CampaignResendMessage" (
    "id" TEXT NOT NULL,
    "resendEmailId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "recipientId" TEXT,
    "campaignId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enviado',
    "clickUrl" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastEventType" TEXT,
    "lastEventAt" TIMESTAMP(3),

    CONSTRAINT "CampaignResendMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignResendMessage_resendEmailId_key" ON "CampaignResendMessage"("resendEmailId");

-- CreateIndex
CREATE INDEX "CampaignResendMessage_campaignId_idx" ON "CampaignResendMessage"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignResendMessage_toEmail_sentAt_idx" ON "CampaignResendMessage"("toEmail", "sentAt");

-- AddForeignKey
ALTER TABLE "CampaignResendMessage" ADD CONSTRAINT "CampaignResendMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
