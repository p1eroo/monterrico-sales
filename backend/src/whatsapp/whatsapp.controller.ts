import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { CrmDataScopeService } from '../auth/crm-data-scope.service';
import { WhatsappService } from './whatsapp.service';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';

type AuthedReq = {
  user: { userId: string; name: string; roleId?: string };
};

@Controller('api/whatsapp')
@UseGuards(PermissionsGuard)
export class WhatsappController {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly crmDataScope: CrmDataScopeService,
  ) {}

  @Get('connection/me')
  async myConnection(@Req() req: AuthedReq) {
    return this.whatsapp.getMyConnection(req.user.userId);
  }

  @Post('connection/me/connect')
  async connectMyWhatsapp(@Req() req: AuthedReq) {
    return this.whatsapp.connectMyWhatsapp(req.user.userId, req.user.name);
  }

  @Post('connection/me/refresh')
  async refreshMyWhatsapp(@Req() req: AuthedReq) {
    return this.whatsapp.refreshMyConnection(req.user.userId);
  }

  @Post('connection/me/disconnect')
  async disconnectMyWhatsapp(@Req() req: AuthedReq) {
    return this.whatsapp.disconnectMyWhatsapp(req.user.userId);
  }

  @Get('messages')
  @RequirePermissions('contactos.ver')
  async list(
    @Req() req: AuthedReq,
    @Query('contactId') contactId: string,
    @Query('limit') limit?: string,
  ) {
    const id = contactId?.trim();
    if (!id) {
      throw new BadRequestException('contactId es obligatorio');
    }
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    const lim = limit ? Number.parseInt(limit, 10) : 50;
    return this.whatsapp.listForContact(
      id,
      scope,
      Number.isFinite(lim) ? lim : 50,
    );
  }

  @Post('send')
  @RequireAnyPermission('contactos.editar', 'campanas.editar')
  async send(@Req() req: AuthedReq, @Body() body: SendWhatsappDto) {
    const contactId = body.contactId?.trim();
    const text = body.text?.trim();
    if (!contactId || !text) {
      throw new BadRequestException('contactId y text son obligatorios');
    }
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.whatsapp.sendFromCrm(
      {
        contactId,
        text,
        instanceApiKey: body.instanceApiKey?.trim(),
      },
      scope,
      req.user.userId,
    );
  }
}
