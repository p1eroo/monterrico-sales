import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { FacebookLeadsService } from './facebook-leads.service';
import { ConnectAccountDto } from './dto/connect-account.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { ImportComercialDto, ImportFlotaDto } from './dto/import-lead.dto';

type AuthedRequest = { user: { userId: string; name: string } };

@Controller('facebook')
@UseGuards(PermissionsGuard)
export class FacebookLeadsController {
  constructor(private readonly facebookLeads: FacebookLeadsService) {}

  @Post('connect')
  @RequirePermissions('marketing.ver')
  async connect(@Body() dto: ConnectAccountDto, @Req() req: AuthedRequest) {
    return this.facebookLeads.connectAccount(req.user.userId, dto);
  }

  @Get('accounts')
  @RequirePermissions('marketing.ver')
  async getAccounts(@Req() req: AuthedRequest) {
    return this.facebookLeads.getAccounts(req.user.userId);
  }

  @Delete('accounts/:id')
  @RequirePermissions('marketing.ver')
  async disconnectAccount(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.facebookLeads.disconnectAccount(id, req.user.userId);
  }

  @Post('accounts/:id/sync-forms')
  @RequirePermissions('marketing.ver')
  async syncForms(@Param('id') id: string) {
    return this.facebookLeads.syncForms(id);
  }

  @Post('accounts/:id/sync-leads')
  @RequirePermissions('marketing.ver')
  async syncLeads(
    @Param('id') id: string,
    @Body() body: { formId?: string },
  ) {
    return this.facebookLeads.syncLeads(id, body.formId);
  }

  @Get('leads')
  @RequirePermissions('marketing.ver')
  async getLeads(@Req() req: AuthedRequest, @Query() query: QueryLeadsDto) {
    return this.facebookLeads.getLeads(req.user.userId, query);
  }

  @Get('stats')
  @RequirePermissions('marketing.ver')
  async getStats(@Req() req: AuthedRequest) {
    return this.facebookLeads.getStats(req.user.userId);
  }

  @Get('forms')
  @RequirePermissions('marketing.ver')
  async getFormsList(@Req() req: AuthedRequest) {
    return this.facebookLeads.getFormsList(req.user.userId);
  }

  @Get('leads/:id/preview-import')
  @RequirePermissions('marketing.ver')
  async previewImport(
    @Param('id') id: string,
    @Query('target') target: 'flota' | 'comercial' = 'flota',
    @Query('entity') entity?: string,
  ) {
    const t = target === 'comercial' ? 'comercial' : 'flota';
    return this.facebookLeads.previewImport(id, t, entity);
  }

  @Post('leads/:id/send-to-comercial')
  @RequirePermissions('marketing.ver')
  async sendToComercial(@Param('id') id: string, @Body() dto: ImportComercialDto, @Req() req: AuthedRequest) {
    return this.facebookLeads.sendToComercial(id, req.user.userId, dto);
  }

  @Post('leads/:id/send-to-flota')
  @RequirePermissions('marketing.ver')
  async sendToFlota(@Param('id') id: string, @Body() dto: ImportFlotaDto, @Req() req: AuthedRequest) {
    return this.facebookLeads.sendToFlota(id, req.user.userId, dto);
  }

  @Delete('leads/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('marketing.ver')
  async deleteLead(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.facebookLeads.deleteLead(id, req.user.userId);
  }

  @Post('leads/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('marketing.ver')
  async bulkDeleteLeads(@Body() body: { ids?: string[]; selectAll?: boolean; formId?: string; search?: string; dateFrom?: string; dateTo?: string }, @Req() req: AuthedRequest) {
    return this.facebookLeads.bulkDeleteLeads(body, req.user.userId);
  }
}
