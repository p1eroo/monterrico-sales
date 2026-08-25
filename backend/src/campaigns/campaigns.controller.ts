import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { SendCampaignEmailDto } from './dto/send-campaign-email.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

type AuthedRequest = { user: { userId: string; name: string } };

const CAMPAIGN_STATUSES = new Set([
  'draft',
  'sending',
  'sent',
  'failed',
  'cancelled',
]);
const CAMPAIGN_CHANNELS = new Set(['email', 'sms', 'whatsapp']);

function parseCsv(raw: string | undefined, allowed: Set<string>): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const values = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => allowed.has(s));
  return values.length ? values : undefined;
}

/**
 * Campañas: disponible para todos los usuarios autenticados (sin permisos).
 * El área (comercial/marketing) se pasa por query para aislar cada apartado.
 */
@Controller('campaigns')
@UseGuards(PermissionsGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('area') area?: string,
  ) {
    const p = page ? Number.parseInt(page, 10) : 1;
    const l = limit ? Number.parseInt(limit, 10) : 50;
    const statuses = parseCsv(status, CAMPAIGN_STATUSES);
    const channels = parseCsv(channel, CAMPAIGN_CHANNELS);
    return this.campaignsService.findSummariesPage(
      Number.isFinite(p) && p > 0 ? p : 1,
      Number.isFinite(l) && l > 0 ? l : 50,
      search,
      statuses,
      channels,
      area,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('area') area?: string) {
    return this.campaignsService.findOne(id, area);
  }

  @Post('send-email')
  sendEmail(@Body() body: SendCampaignEmailDto) {
    return this.campaignsService.sendCampaignEmail(body);
  }

  @Post()
  create(@Body() dto: CreateCampaignDto, @Req() req: AuthedRequest) {
    return this.campaignsService.create(dto, req.user.userId, req.user.name);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @Req() req: AuthedRequest,
    @Query('area') area?: string,
  ) {
    return this.campaignsService.update(id, dto, req.user.userId, area);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Query('area') area?: string,
  ) {
    return this.campaignsService.remove(id, req.user.userId, area);
  }
}
