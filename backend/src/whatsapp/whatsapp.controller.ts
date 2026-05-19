import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CrmDataScopeService } from '../auth/crm-data-scope.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { WhatsappService } from './whatsapp.service';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import { SendTestWhatsappDto } from './dto/send-test-whatsapp.dto';
import { MediaUploadService } from '../media/media-upload.service';
import sharp from 'sharp';

type AuthedReq = {
  user: { userId: string; name: string; roleId?: string };
  headers: { authorization?: string };
};

@Controller('api/whatsapp')
@UseGuards(PermissionsGuard)
export class WhatsappController {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly crmDataScope: CrmDataScopeService,
    private readonly mediaUpload: MediaUploadService,
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
  @RequireAnyPermission('contactos.ver', 'flota_mensajes.ver', 'flota_prospectos.ver')
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
  @RequireAnyPermission('contactos.editar', 'campanas.editar', 'flota_mensajes.editar', 'flota_prospectos.editar')
  async send(@Req() req: AuthedReq, @Body() body: SendWhatsappDto) {
    const contactId = body.contactId?.trim();
    const text = body.text?.trim();
    if ((!contactId && !body.phone?.trim()) || (!text && !body.imageUrl)) {
      throw new BadRequestException('contactId (o phone) y text o imageUrl son obligatorios');
    }
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.whatsapp.sendFromCrm(
      {
        contactId,
        text,
        phone: body.phone?.trim(),
        name: body.name?.trim(),
        instanceApiKey: body.instanceApiKey?.trim(),
        imageUrl: body.imageUrl?.trim(),
        flotaProspectoId: body.flotaProspectoId?.trim(),
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
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async conversations(@Query('q') q?: string) {
    return this.whatsapp.getConversations(q?.trim() || undefined);
  }

  @Get('flota/prospectos/:id/messages')
  async flotaProspectoMessages(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const lim = Number.isFinite(Number.parseInt(limit ?? '50', 10))
      ? Number.parseInt(limit ?? '50', 10)
      : 50;
    return this.whatsapp.listForFlotaProspecto(id, lim);
  }

  @Post('flota/send')
  async flotaSend(
    @Req() req: AuthedReq,
    @Body() body: { prospectoId: string; text: string },
  ) {
    const prospectoId = body.prospectoId?.trim();
    const text = body.text?.trim();
    if (!prospectoId || !text) {
      throw new BadRequestException('prospectoId y text son obligatorios');
    }
    return this.whatsapp.sendFromFlotaProspecto(prospectoId, text, req.user.userId);
  }

  @Post('send-bulk')
  async sendBulk(
    @Req() req: AuthedReq,
    @Body() body: { contactIds: string[]; text: string; imageUrl?: string },
  ) {
    const text = body.text?.trim();
    if (!text && !body.imageUrl?.trim()) {
      throw new BadRequestException('text o imageUrl son obligatorios');
    }
    if (!body.contactIds?.length) {
      throw new BadRequestException('contactIds debe ser un array con al menos un ID');
    }
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.whatsapp.sendBulk(
      { contactIds: body.contactIds, text: text || '', imageUrl: body.imageUrl?.trim() },
      scope,
      req.user.userId,
    );
  }

  @Post('flota/upload-image')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadFlotaImage(
    @Req() req: AuthedReq,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Adjunta una imagen (max 10MB)');
    }
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Solo se permiten PNG, JPG, WEBP, GIF o AVIF');
    }
    const webpBuffer = await sharp(file.buffer).webp({ quality: 85 }).toBuffer();
    const webpName = file.originalname.replace(/\.[^.]+$/, '') + '.webp';
    const authHeader = req.headers['authorization'];
    const url = await this.mediaUpload.uploadToMediaProxy(
      webpBuffer,
      webpName,
      'image/webp',
      { authorizationHeader: authHeader },
    );
    return { url };
  }

  @Public()
  @Get('media/proxy/:messageId')
  async proxyMedia(
    @Param('messageId') messageId: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const result = await this.whatsapp.downloadMediaFromEvolution(messageId);
    if (!result) {
      throw new NotFoundException('Imagen no encontrada o expirada');
    }
    res.set({
      'Content-Type': result.mimeType,
      'Content-Length': result.buffer.length,
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(result.buffer);
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
