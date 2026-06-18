import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatwootClient } from './chatwoot.client';
import { ChatwootService } from './chatwoot.service';
import { ChatwootController } from './chatwoot.controller';
import { ChatwootWebhookController } from './chatwoot-webhook.controller';
import { ChatwootWebhookService } from './chatwoot-webhook.service';
import { ChatwootGateway } from './chatwoot.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [ChatwootController, ChatwootWebhookController],
  providers: [
    ChatwootClient,
    ChatwootService,
    ChatwootWebhookService,
    ChatwootGateway,
  ],
  exports: [ChatwootService],
})
export class ChatwootModule {}
