import { Controller, Post, Body, Headers } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ChatwootWebhookService } from './chatwoot-webhook.service';
import type { ChatwootWebhookPayload } from './chatwoot.types';

@Controller('api/chatwoot/webhook')
export class ChatwootWebhookController {
  constructor(private readonly service: ChatwootWebhookService) {}

  @Public()
  @Post()
  async handleWebhook(
    @Body() payload: ChatwootWebhookPayload,
    @Headers('x-chatwoot-signature') _signature?: string,
  ) {
    return this.service.handle(payload);
  }
}
