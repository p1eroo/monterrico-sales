import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { CrmDataScopeService } from '../auth/crm-data-scope.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { WhatsappService } from './whatsapp.service';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import { SendTestWhatsappDto } from './dto/send-test-whatsapp.dto';

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

  @Post('connection/me/disconnect')
  async disconnectMyWhatsapp(@Req() req: AuthedReq) {
    return this.whatsapp.disconnectMyWhatsapp(req.user.userId);
  }

  @Post('connection/me/test-message')
  async sendMyTestWhatsapp(
    @Req() req: AuthedReq,
    @Body() body: SendTestWhatsappDto,
  ) {
    const number = body.number?.trim();
    const text = body.text?.trim();
    if (!number || !text) {
      throw new BadRequestException('number y text son obligatorios');
    }
    return this.whatsapp.sendMyTestMessage(req.user.userId, { number, text });
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

  // ─── Instancia compartida de Flota ───

  @Get('shared/connection')
  async sharedConnection() {
    return this.whatsapp.getSharedConnection();
  }

  @Post('shared/connect')
  async connectShared() {
    return this.whatsapp.connectSharedWhatsapp();
  }

  @Post('shared/disconnect')
  async disconnectShared() {
    return this.whatsapp.disconnectSharedWhatsapp();
  }

  @Post('shared/test')
  async sharedTest(@Body() body: SendTestWhatsappDto) {
    const number = body.number?.trim();
    const text = body.text?.trim();
    if (!number || !text) {
      throw new BadRequestException('number y text son obligatorios');
    }
    return this.whatsapp.sendSharedTestMessage({ number, text });
  }

  @Get('conversations')
  async conversations(@Query('q') q?: string) {
    return this.whatsapp.getConversations(q?.trim() || undefined);
  }

  @Post('send-bulk')
  async sendBulk(
    @Req() req: AuthedReq,
    @Body() body: { contactIds: string[]; text: string },
  ) {
    const text = body.text?.trim();
    if (!text) {
      throw new BadRequestException('text es obligatorio');
    }
    if (!body.contactIds?.length) {
      throw new BadRequestException('contactIds debe ser un array con al menos un ID');
    }
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.whatsapp.sendBulk(
      { contactIds: body.contactIds, text },
      scope,
      req.user.userId,
    );
  }

  @Post('import-excel')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async importExcel(@Req() _req: AuthedReq, @UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Adjunta un archivo Excel (.xlsx)');
    }
    return this.whatsapp.importExcelPreview(file.buffer);
  }
}
