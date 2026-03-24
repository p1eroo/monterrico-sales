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
  ) {
    const p = page ? Number.parseInt(page, 10) : 1;
    const l = limit ? Number.parseInt(limit, 10) : 50;
    return this.campaignsService.findSummariesPage(
      Number.isFinite(p) && p > 0 ? p : 1,
      Number.isFinite(l) && l > 0 ? l : 50,
      search,
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
