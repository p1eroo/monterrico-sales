import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WebLeadsService } from './web-leads.service';
import { CreateWebLeadDto } from './dto/create-web-lead.dto';

@Controller('api/webhooks/web-leads')
export class WebLeadsController {
  constructor(
    private readonly config: ConfigService,
    private readonly webLeads: WebLeadsService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateWebLeadDto, @Req() req: Request) {
    const expected = this.config.get<string>('WEB_LEADS_API_KEY');
    const provided = (req.headers['x-api-key'] as string | undefined) ?? '';

    if (!expected || provided !== expected) {
      throw new UnauthorizedException('API key inválida');
    }

    return this.webLeads.create(body);
  }
}
