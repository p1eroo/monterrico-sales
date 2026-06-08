import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesService } from './files.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

type AuthedRequest = {
  user: { userId: string; name: string };
  headers: { authorization?: string };
};

const uploadStorage = memoryStorage();

@Controller('files')
@UseGuards(PermissionsGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @RequirePermissions('archivos.ver')
  findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.filesService.findAll(entityType, entityId);
  }

  @Post()
  @RequirePermissions('archivos.crear')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadStorage,
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  async upload(
    @Req() req: AuthedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: {
      entityType?: string;
      entityId?: string;
      entityName?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
      relatedEntityName?: string;
    },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Falta el archivo (campo file)');
    }
    const et = body?.entityType?.trim();
    const eid = body?.entityId?.trim();
    if (!et || !eid) {
      throw new BadRequestException('entityType y entityId son obligatorios');
    }
    return this.filesService.create(req.user.userId, {
      buffer: file.buffer,
      originalName: file.originalname || 'archivo',
      mimeType: file.mimetype || 'application/octet-stream',
      entityType: et,
      entityId: eid,
      entityName: body?.entityName?.trim(),
      relatedEntityType: body?.relatedEntityType?.trim(),
      relatedEntityId: body?.relatedEntityId?.trim(),
      relatedEntityName: body?.relatedEntityName?.trim(),
      authorizationHeader:
        typeof req.headers.authorization === 'string'
          ? req.headers.authorization
          : undefined,
    });
  }

  /** Descarga o vista previa con Content-Type correcto (proxy; evita CDNs con cabeceras erróneas). */
  @Get(':id/content')
  @RequirePermissions('archivos.ver')
  async streamContent(
    @Param('id') id: string,
    @Query('disposition') disposition?: string,
  ): Promise<StreamableFile> {
    const disp = disposition === 'attachment' ? 'attachment' : 'inline';
    const { stream, mimeType, contentDisposition } =
      await this.filesService.openContentStream(id, disp);
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: contentDisposition,
    });
  }

  @Get(':id/url')
  @RequirePermissions('archivos.ver')
  presign(
    @Param('id') id: string,
    @Query('disposition') disposition?: string,
  ) {
    const disp =
      disposition === 'attachment' ? 'attachment' : 'inline';
    return this.filesService.presignGet(id, disp);
  }

  @Delete(':id')
  @RequirePermissions('archivos.eliminar')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.filesService.remove(id, req.user.userId);
  }
}
