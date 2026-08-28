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
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { ConnectWhatsAppCloudDto } from './dto/connect-account.dto';
import { UpdateWhatsAppTokenDto } from './dto/update-token.dto';
import { CreateWhatsAppCampaignDto } from './dto/create-campaign.dto';
import { UpdateTemplateDailyLimitDto } from './dto/update-template-limit.dto';

type AuthedRequest = { user: { userId: string; name: string } };

@Controller('whatsapp-cloud')
@UseGuards(PermissionsGuard)
export class WhatsappCloudController {
  constructor(private readonly whatsappCloud: WhatsappCloudService) {}

  @Post('connect')
  @RequirePermissions('marketing.ver')
  async connect(@Body() dto: ConnectWhatsAppCloudDto, @Req() req: AuthedRequest) {
    return this.whatsappCloud.connectAccount(req.user.userId, dto);
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('marketing.ver')
  async testConnection(@Body() dto: ConnectWhatsAppCloudDto) {
    return this.whatsappCloud.testConnection(dto);
  }

  @Get('accounts')
  @RequirePermissions('marketing.ver')
  async getAccounts(@Req() req: AuthedRequest) {
    return this.whatsappCloud.getAccounts(req.user.userId);
  }

  @Delete('accounts/:id')
  @RequirePermissions('marketing.ver')
  async disconnect(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.whatsappCloud.disconnectAccount(id, req.user.userId);
  }

  @Patch('accounts/:id/token')
  @RequirePermissions('marketing.ver')
  async updateToken(
    @Param('id') id: string,
    @Body() dto: UpdateWhatsAppTokenDto,
    @Req() req: AuthedRequest,
  ) {
    return this.whatsappCloud.updateToken(id, req.user.userId, dto.accessToken);
  }

  @Post('accounts/:id/default')
  @RequirePermissions('marketing.ver')
  async setDefault(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.whatsappCloud.setDefaultAccount(id, req.user.userId);
  }

  @Post('accounts/:id/test-connection')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('marketing.ver')
  async testAccountConnection(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.whatsappCloud.testAccountConnection(id, req.user.userId);
  }

  @Post('accounts/:id/sync-templates')
  @RequirePermissions('marketing.ver')
  async syncTemplates(@Param('id') id: string) {
    return this.whatsappCloud.syncTemplates(id);
  }

  @Get('templates')
  @RequirePermissions('marketing.ver')
  async getTemplates(@Query('accountId') accountId: string) {
    return this.whatsappCloud.getTemplates(accountId);
  }

  @Patch('templates/:id/daily-limit')
  @RequirePermissions('marketing.ver')
  async updateTemplateDailyLimit(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDailyLimitDto,
  ) {
    return this.whatsappCloud.updateTemplateDailyLimit(id, dto.dailySendLimit ?? null);
  }

  @Get('campaigns')
  @RequirePermissions('marketing.ver')
  async listCampaigns(@Req() req: AuthedRequest, @Query('accountId') accountId?: string) {
    return this.whatsappCloud.listCampaigns(req.user.userId, accountId);
  }

  @Post('campaigns')
  @RequirePermissions('marketing.ver')
  async createCampaign(
    @Body() dto: CreateWhatsAppCampaignDto,
    @Req() req: AuthedRequest,
  ) {
    return this.whatsappCloud.createCampaign(req.user.userId, req.user.name, dto);
  }

  @Post('campaigns/:id/send')
  @RequirePermissions('marketing.ver')
  async sendCampaign(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.whatsappCloud.startSendCampaign(id, req.user.userId);
  }

  @Get('campaigns/:id')
  @RequirePermissions('marketing.ver')
  async getCampaign(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.whatsappCloud.getCampaign(id, req.user.userId);
  }
}
