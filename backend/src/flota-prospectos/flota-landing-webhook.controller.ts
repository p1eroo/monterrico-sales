import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { FlotaConductorMatchService } from './flota-conductor-match.service';

const DEFAULT_WHATSAPP_URL =
  'https://wa.me/51967304427?text=QUIERO%20PERTENECER%20A%20LA%20FLOTA%20DE%20DELIVERY';

type ProspectoWebhookResult = {
  status: 'ok';
  prospectoId: string;
  nombreCompleto: string;
  celular: string | null;
  existing: boolean;
  whatsappUrl: string;
};

@Controller('api/webhooks/flota-prospecto')
export class FlotaLandingWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly conductorMatch: FlotaConductorMatchService,
  ) {}

  @Public()
  @Post()
  async create(
    @Body() body: Record<string, string | undefined>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const wantsJson = this.wantsJsonResponse(req);

    try {
      this.assertApiKey(req, body);
      const result = await this.upsertProspecto(body);
      const whatsappUrl = this.buildWhatsAppUrl(result.nombreCompleto);

      if (!wantsJson) {
        res.redirect(302, whatsappUrl);
        return;
      }

      return { ...result, whatsappUrl };
    } catch (err) {
      if (!wantsJson) {
        this.respondHtmlError(res, err);
        return;
      }
      throw err;
    }
  }

  private wantsJsonResponse(req: Request): boolean {
    if (req.query.format === 'json') return true;
    const contentType = (req.headers['content-type'] ?? '').toLowerCase();
    if (contentType.includes('application/json')) return true;
    const accept = (req.headers.accept ?? '').toLowerCase();
    if (accept.includes('application/json') && !accept.includes('text/html')) return true;
    return false;
  }

  private assertApiKey(req: Request, body: Record<string, string | undefined>) {
    const expected = this.config.get<string>('FLOTA_WEBHOOK_API_KEY');
    const provided =
      (req.headers['x-api-key'] as string | undefined) ??
      body.api_key ??
      body.apiKey ??
      (typeof req.query.api_key === 'string' ? req.query.api_key : undefined) ??
      '';

    if (!expected || provided !== expected) {
      throw new UnauthorizedException('API key inválida');
    }
  }

  private buildWhatsAppUrl(nombreCompleto: string): string {
    const configured =
      this.config.get<string>('FLOTA_WEBHOOK_WHATSAPP_URL')?.trim() || DEFAULT_WHATSAPP_URL;
    const appendName = this.config.get<string>('FLOTA_WEBHOOK_WHATSAPP_APPEND_NAME') === 'true';
    if (!appendName || !nombreCompleto.trim()) return configured;

    try {
      const url = new URL(configured);
      const baseText = url.searchParams.get('text') ?? '';
      url.searchParams.set('text', `${baseText} - ${nombreCompleto.trim()}`);
      return url.toString();
    } catch {
      return configured;
    }
  }

  private async upsertProspecto(
    body: Record<string, string | undefined>,
  ): Promise<Omit<ProspectoWebhookResult, 'whatsappUrl'>> {
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
      select: { id: true, nombreCompleto: true, celular: true, estado: true },
    });

    await this.conductorMatch.afiliarSiConductor(created);

    return {
      status: 'ok',
      prospectoId: created.id,
      nombreCompleto: created.nombreCompleto,
      celular: created.celular,
      existing: false,
    };
  }

  private respondHtmlError(res: Response, err: unknown) {
    const status = err instanceof HttpException ? err.getStatus() : 400;
    const message =
      err instanceof HttpException
        ? this.httpExceptionMessage(err)
        : 'No se pudo registrar el prospecto';

    res
      .status(status)
      .type('html')
      .send(
        `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Error</title></head>` +
          `<body style="font-family:sans-serif;padding:2rem;text-align:center">` +
          `<p>${this.escapeHtml(message)}</p>` +
          `<p><a href="https://taximonterrico.com/drivers">Volver al formulario</a></p>` +
          `</body></html>`,
      );
  }

  private httpExceptionMessage(err: HttpException): string {
    const response = err.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const msg = (response as { message?: string | string[] }).message;
      return Array.isArray(msg) ? msg.join(', ') : String(msg ?? err.message);
    }
    return err.message;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
