import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { EvogoClient } from './evogo.client';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappGateway } from './whatsapp.gateway';

@Module({
  imports: [ContactsModule, NotificationsModule, AuthModule],
  controllers: [WhatsappController, WhatsappWebhookController],
  providers: [EvogoClient, WhatsappService, WhatsappGateway],
  exports: [WhatsappService],
})
export class WhatsappModule {}
