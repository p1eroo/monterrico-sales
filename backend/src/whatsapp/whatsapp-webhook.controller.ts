import { Controller, Post, Body, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsappService } from './whatsapp.service';

/**
 * Evolution GO envía POST JSON sin firma HMAC.
 * Protege la URL con un query secreto: `?token=TU_SECRETO` (= EVOGO_WEBHOOK_SECRET).
 */
@Controller('api/webhooks/evolution-go')
export class WhatsappWebhookController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Public()
  @Post()
  async receive(
    @Query('token') token: string | undefined,
    @Body() body: unknown,
  ) {
    return this.whatsapp.handleEvolutionWebhook(token, body);
  }
}
