import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { MediaModule } from '../media/media.module';
import { ChatwootClient } from './chatwoot.client';
import { ChatwootService } from './chatwoot.service';
import { ChatwootController } from './chatwoot.controller';
import { ChatwootWebhookController } from './chatwoot-webhook.controller';
import { ChatwootWebhookService } from './chatwoot-webhook.service';
import { ChatwootEventService } from './chatwoot-event.service';
import { ChatwootOperadorSyncService } from './chatwoot-operador-sync.service';
import { ChatwootOperadorReconcileScheduler } from './chatwoot-operador-reconcile.scheduler';
import { ChatwootAttachmentStorageService } from './chatwoot-attachment-storage.service';

@Global()
@Module({
  imports: [PrismaModule, FilesModule, MediaModule],
  controllers: [ChatwootController, ChatwootWebhookController],
  providers: [
    ChatwootClient,
    ChatwootService,
    ChatwootWebhookService,
    ChatwootEventService,
    ChatwootOperadorSyncService,
    ChatwootOperadorReconcileScheduler,
    ChatwootAttachmentStorageService,
  ],
  exports: [ChatwootService, ChatwootEventService, ChatwootOperadorSyncService],
})
export class ChatwootModule {}
