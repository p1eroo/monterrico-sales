import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { MediaModule } from '../media/media.module';
import { EvogoClient } from './evogo.client';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappGateway } from './whatsapp.gateway';
import { WhatsappProspectoNameSyncService } from './whatsapp-prospecto-name-sync.service';

@Module({
  imports: [ContactsModule, NotificationsModule, AuthModule, FilesModule, MediaModule],
  controllers: [WhatsappController, WhatsappWebhookController],
  providers: [EvogoClient, WhatsappService, WhatsappGateway, WhatsappProspectoNameSyncService],
  exports: [WhatsappService, WhatsappProspectoNameSyncService],
})
export class WhatsappModule {}
