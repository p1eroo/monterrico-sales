import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatwootClient } from './chatwoot.client';
import { ChatwootService } from './chatwoot.service';
import { ChatwootController } from './chatwoot.controller';
import { ChatwootWebhookController } from './chatwoot-webhook.controller';
import { ChatwootWebhookService } from './chatwoot-webhook.service';
import { ChatwootEventService } from './chatwoot-event.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [ChatwootController, ChatwootWebhookController],
  providers: [
    ChatwootClient,
    ChatwootService,
    ChatwootWebhookService,
    ChatwootEventService,
  ],
  exports: [ChatwootService, ChatwootEventService],
})
export class ChatwootModule {}
