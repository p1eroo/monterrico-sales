import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { InboundEmailController } from './inbound-email.controller';
import { InboundEmailService } from './inbound-email.service';
import { MailboxController } from './mailbox.controller';
import { MailboxService } from './mailbox.service';
import { ResendWebhookController } from './resend-webhook.controller';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule, AuthModule],
  controllers: [
    MailboxController,
    InboundEmailController,
    CampaignsController,
    ResendWebhookController,
  ],
  providers: [CampaignsService, InboundEmailService, MailboxService],
})
export class CampaignsModule {}
