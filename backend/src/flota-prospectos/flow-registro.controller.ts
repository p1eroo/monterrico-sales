import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { FlotaDocumentExtractionService } from './flota-document-extraction.service';

@Controller('api/flow')
export class FlowRegistroController {
  private readonly logger = new Logger(FlowRegistroController.name);
  private cachedBotUserId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly documentExtraction: FlotaDocumentExtractionService,
  ) {}

  private async resolveBotUserId(): Promise<string> {
    if (this.cachedBotUserId) return this.cachedBotUserId;

    const configured = process.env.FLOW_BOT_USER_ID;
    if (configured) {
      const user = await this.prisma.user.findUnique({
        where: { id: configured },
        select: { id: true },
      });
      if (user) {
        this.cachedBotUserId = user.id;
        return user.id;
      }
    }

    const existing = await this.prisma.user.findFirst({
      where: { name: 'Flow Bot' },
      select: { id: true },
    });
    if (existing) {
      this.cachedBotUserId = existing.id;
      return existing.id;
    }

    let role = await this.prisma.role.findFirst({
      where: { isSystem: true },
      select: { id: true },
    });
    if (!role) {
      role = await this.prisma.role.create({
        data: {
          name: 'Sistema',
          slug: 'sistema',
          description: 'Rol para usuarios de sistema y bots',
          isSystem: true,
        },
        select: { id: true },
      });
    }

    const user = await this.prisma.user.create({
      data: {
        name: 'Flow Bot',
        roleId: role.id,
        status: 'activo',
      },
      select: { id: true },
    });

    this.logger.log(`Usuario Flow Bot creado: ${user.id}`);
    this.cachedBotUserId = user.id;
    return user.id;
  }

  @Public()
  @Post('registro-prospecto')
  @UseInterceptors(
    FilesInterceptor('archivos', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async registro(
    @Query('token') token: string | undefined,
    @Body()
    body: {
      phone?: string;
      nombre?: string;
      ciudad?: string;
      modalidad?: string;
      distrito?: string;
      aireAcondicionado?: string;
      redSocial?: string;
      observaciones?: string;
    },
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const secret = process.env.FLOW_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.error('FLOW_WEBHOOK_SECRET no configurado');
      throw new HttpException(
        'Servicio no configurado',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!token || token !== secret) {
      throw new UnauthorizedException('Token inválido');
    }

    const phone = (body.phone || '').replace(/\D/g, '');
    if (phone.length < 8) {
      throw new BadRequestException('phone es obligatorio (mínimo 8 dígitos)');
    }

    const cleaned = phone.slice(-9);
    const nombreRaw = (body.nombre || '').trim();

    let prospecto = await this.prisma.flotaProspecto.findFirst({
      where: {
        OR: [
          { celular: { contains: cleaned } },
          { movil: { contains: cleaned } },
        ],
      },
    });

    if (prospecto) {
      const updateData: Record<string, unknown> = {};
      if (prospecto.eliminadoAt) {
        updateData.eliminadoAt = null;
      }
      if (nombreRaw && prospecto.nombreCompleto !== nombreRaw) {
        updateData.nombreCompleto = nombreRaw;
      }
      if (body.ciudad !== undefined) {
        updateData.ciudad = body.ciudad || null;
      }
      if (body.modalidad !== undefined) {
        updateData.modalidad = body.modalidad || null;
      }
      if (body.distrito !== undefined) {
        updateData.distrito = body.distrito || null;
      }
      if (body.aireAcondicionado !== undefined) {
        updateData.aireAcondicionado = body.aireAcondicionado || null;
      }
      if (body.redSocial !== undefined) {
        updateData.redSocial = body.redSocial || null;
      }
      if (body.observaciones !== undefined) {
        updateData.observaciones = body.observaciones || null;
      }
      if (Object.keys(updateData).length > 0) {
        prospecto = await this.prisma.flotaProspecto.update({
          where: { id: prospecto.id },
          data: updateData,
        });
      }
    } else {
      prospecto = await this.prisma.flotaProspecto.create({
        data: {
          nombreCompleto: nombreRaw || `Pendiente DNI (${cleaned})`,
          celular: cleaned.length === 9 ? '51' + cleaned : cleaned,
          ciudad: body.ciudad || null,
          modalidad: body.modalidad || null,
          distrito: body.distrito || null,
          aireAcondicionado: body.aireAcondicionado || null,
          redSocial: body.redSocial || null,
          observaciones: body.observaciones || null,
          estado: 'Nuevo',
          origen: 'FLOW',
          fechaRegistro: new Date(),
        },
      });
    }

    const archivos: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      size: number;
      storageKey: string;
    }> = [];

    const filesForExtraction: Array<{
      buffer: Buffer;
      mimeType: string;
      originalName?: string;
    }> = [];

    if (files && files.length > 0) {
      const botUserId = await this.resolveBotUserId();
      const authHeader = req.headers.authorization;
      for (const file of files) {
        try {
          const created = await this.filesService.create(botUserId, {
            buffer: file.buffer,
            originalName: file.originalname || 'archivo',
            mimeType: file.mimetype || 'application/octet-stream',
            entityType: 'flota-prospecto',
            entityId: prospecto.id,
            authorizationHeader: authHeader,
          });
          archivos.push({
            id: created.id,
            originalName: created.name,
            mimeType: created.mimeType,
            size: created.size,
            storageKey: '',
          });
          filesForExtraction.push({
            buffer: file.buffer,
            mimeType: file.mimetype || 'application/octet-stream',
            originalName: file.originalname,
          });
        } catch (e) {
          this.logger.warn(
            `Error al subir archivo ${file.originalname}: ${e instanceof Error ? e.message : e}`,
          );
        }
      }
    }

    if (filesForExtraction.length > 0) {
      try {
        await this.documentExtraction.processFiles(
          prospecto.id,
          filesForExtraction,
        );
        prospecto =
          (await this.prisma.flotaProspecto.findUnique({
            where: { id: prospecto.id },
          })) ?? prospecto;
      } catch (e) {
        this.logger.warn(
          `Extracción de documentos falló para prospecto ${prospecto.id}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    return {
      prospecto: {
        id: prospecto.id,
        nombreCompleto: prospecto.nombreCompleto,
        celular: prospecto.celular,
        ciudad: prospecto.ciudad,
        modalidad: prospecto.modalidad,
        estado: prospecto.estado,
      },
      archivos,
    };
  }
}
