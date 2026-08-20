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
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

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

@Controller('campaigns')
@UseGuards(PermissionsGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @RequirePermissions('campanas.ver')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
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
    );
  }

  @Get(':id')
  @RequirePermissions('campanas.ver')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Post('send-email')
  @RequirePermissions('campanas.crear')
  sendEmail(@Body() body: SendCampaignEmailDto) {
    return this.campaignsService.sendCampaignEmail(body);
  }

  @Post()
  @RequirePermissions('campanas.crear')
  create(@Body() dto: CreateCampaignDto, @Req() req: AuthedRequest) {
    return this.campaignsService.create(dto, req.user.userId, req.user.name);
  }

  @Patch(':id')
  @RequirePermissions('campanas.crear')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @Req() req: AuthedRequest,
  ) {
    return this.campaignsService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('campanas.crear')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.campaignsService.remove(id, req.user.userId);
  }
}
