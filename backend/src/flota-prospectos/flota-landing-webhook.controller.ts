import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/webhooks/flota-prospecto')
export class FlotaLandingWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: { name?: string; phone?: string },
    @Req() req: Request,
  ) {
    const expected = this.config.get<string>('FLOTA_WEBHOOK_API_KEY');
    const provided = (req.headers['x-api-key'] as string | undefined) ?? '';

    if (!expected || provided !== expected) {
      throw new UnauthorizedException('API key inválida');
    }

    const phoneDigits = (body.phone || '').replace(/\D/g, '');
    if (phoneDigits.length < 8) {
      throw new BadRequestException('phone es obligatorio (mínimo 8 dígitos)');
    }
    const last9 = phoneDigits.slice(-9);
    const name = (body.name || '').trim();

    const existing = await this.prisma.flotaProspecto.findFirst({
      where: {
        OR: [{ celular: { endsWith: last9 } }, { movil: { endsWith: last9 } }],
      },
      select: {
        id: true,
        nombreCompleto: true,
        celular: true,
        eliminadoAt: true,
      },
    });

    if (existing) {
      if (existing.eliminadoAt) {
        const reactivated = await this.prisma.flotaProspecto.update({
          where: { id: existing.id },
          data: {
            eliminadoAt: null,
            ...(name ? { nombreCompleto: name } : {}),
          },
          select: { id: true, nombreCompleto: true, celular: true },
        });
        return {
          status: 'ok',
          prospectoId: reactivated.id,
          nombreCompleto: reactivated.nombreCompleto,
          celular: reactivated.celular,
          existing: false,
        };
      }
      return {
        status: 'ok',
        prospectoId: existing.id,
        nombreCompleto: existing.nombreCompleto,
        celular: existing.celular,
        existing: true,
      };
    }

    const celular = `+51${last9}`;
    const created = await this.prisma.flotaProspecto.create({
      data: {
        nombreCompleto: name || `Pendiente (${last9})`,
        celular,
        redSocial: 'Web',
        estado: 'Nuevo',
        fechaRegistro: new Date(),
      },
      select: { id: true, nombreCompleto: true, celular: true },
    });

    return {
      status: 'ok',
      prospectoId: created.id,
      nombreCompleto: created.nombreCompleto,
      celular: created.celular,
      existing: false,
    };
  }
}
