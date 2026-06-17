import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';
import { FacebookLeadsService } from './facebook-leads.service';

@Controller('api/webhooks/facebook')
export class FacebookLeadsWebhookController {
  private readonly logger = new Logger(FacebookLeadsWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly facebookLeads: FacebookLeadsService,
  ) {}

  @Public()
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
  ) {
    const expected = this.config.get<string>('FACEBOOK_WEBHOOK_VERIFY_TOKEN');
    this.logger.log(`Webhook verification: mode=${mode} token=${token}`);

    if (mode === 'subscribe' && token === expected && challenge) {
      return challenge;
    }

    this.logger.warn(`Webhook verification failed: expected token="${expected}" got="${token}"`);
    return 'Verification failed';
  }

  @Public()
  @Post()
  async receiveEvent(@Body() body: Record<string, unknown>) {
    this.logger.debug(`Facebook webhook event received: ${JSON.stringify({ entry_count: (body.entry as unknown[])?.length })}`);

    try {
      const entries = body.entry as Array<{ id: string; time: number; changes: Array<{ field: string; value: { leadgen_id?: string; page_id?: string; form_id?: string } }> }> | undefined;
      if (!entries) return { status: 'ok' };

      for (const entry of entries) {
        for (const change of entry.changes || []) {
          if (change.field === 'leadgen' && change.value?.leadgen_id) {
            const leadgenId = change.value.leadgen_id;
            const pageId = change.value.page_id || entry.id;

            this.logger.log(`Processing leadgen: id=${leadgenId} page=${pageId}`);

            await this.facebookLeads.importWebhookLead(leadgenId, pageId);
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error processing webhook: ${err}`);
    }

    return { status: 'ok' };
  }
}
