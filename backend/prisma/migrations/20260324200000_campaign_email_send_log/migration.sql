-- Historial de envíos masivos (límite por correo / ventana de 1 h)
CREATE TABLE "CampaignEmailSendLog" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEmailSendLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignEmailSendLog_toEmail_sentAt_idx" ON "CampaignEmailSendLog"("toEmail", "sentAt");
