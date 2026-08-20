import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { InboundEmailService } from './inbound-email.service';

@Controller('api/webhooks/resend')
export class ResendWebhookController {
  constructor(private readonly inbound: InboundEmailService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const raw = req.rawBody;
    const payload =
      raw && raw.length > 0
        ? raw.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body ?? {});
    return this.inbound.handleWebhook(payload, headers);
  }
}
