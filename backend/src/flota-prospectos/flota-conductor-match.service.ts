import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { FlotaProspectosGateway } from './flota-prospectos.gateway';
import { limaDate, normalizeEstado } from './flota-prospectos.utils';

const DEFAULT_CONDUCTORES_API_URL =
  'https://api.taximonterrico.com/api/WAsociados/registrados';

const CACHE_TTL_MS = 15 * 60 * 1000;

interface RegisteredConductor {
  codigo?: string;
  telefonop?: string;
  telefonos?: string;
}

export interface AfiliacionStats {
  checked: number;
  updated: number;
}

function normalizarTelefono(telefono: string): string {
  if (!telefono) return '';
  return telefono.replace(/\D/g, '').replace(/^51/, '');
}

/** Servicio global: detecta si el celular de un prospecto pertenece a un conductor
 *  registrado (API externa) y lo pasa automáticamente a estado Afiliado. */
@Injectable()
export class FlotaConductorMatchService {
  private readonly logger = new Logger(FlotaConductorMatchService.name);
  private cache: { phones: Set<string>; at: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activityLogs: ActivityLogsService,
    private readonly prospectosGateway: FlotaProspectosGateway,
  ) {}

  private apiUrl(): string {
    return (
      this.config.get<string>('CONDUCTORES_API_URL')?.trim() ||
      DEFAULT_CONDUCTORES_API_URL
    );
  }

  /** Teléfonos normalizados de conductores registrados, con caché en memoria. */
  async getRegisteredPhones(): Promise<Set<string>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.phones;
    }

    const phones = new Set<string>();
    try {
      const res = await fetch(`${this.apiUrl()}?idestado=0`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`API conductores respondió ${res.status}`);
      }
      const data = (await res.json()) as {
        ARegistrados?: RegisteredConductor[];
      };
      for (const conductor of data.ARegistrados ?? []) {
        for (const field of ['telefonop', 'telefonos'] as const) {
          const raw = conductor[field] ?? '';
          for (const part of raw.split('/')) {
            const norm = normalizarTelefono(part);
            if (norm.length >= 6) phones.add(norm);
          }
        }
      }
      this.cache = { phones, at: Date.now() };
    } catch (err) {
      if (this.cache) {
        this.logger.warn(`API conductores falló, usando caché previa: ${err}`);
        return this.cache.phones;
      }
      this.logger.error(`API conductores falló: ${err}`);
    }
    return phones;
  }

  async isConductorPhone(celular?: string | null): Promise<boolean> {
    if (!celular) return false;
    const norm = normalizarTelefono(celular);
    if (norm.length < 6) return false;
    const phones = await this.getRegisteredPhones();
    return phones.has(norm);
  }

  /** Si el celular del prospecto matchea un conductor registrado, lo pasa a Afiliado. */
  async afiliarSiConductor(prospecto: {
    id: string;
    celular?: string | null;
    estado?: string | null;
    nombreCompleto?: string;
  }): Promise<boolean> {
    try {
      if (!prospecto.celular) return false;
      if (normalizeEstado(prospecto.estado ?? 'Nuevo') === 'Afiliado') {
        return false;
      }
      const norm = normalizarTelefono(prospecto.celular);
      if (norm.length < 6) return false;
      const phones = await this.getRegisteredPhones();
      if (!phones.has(norm)) return false;
      await this.marcarAfiliado(prospecto.id);
      return true;
    } catch (err) {
      this.logger.error(
        `afiliarSiConductor falló para ${prospecto.id}: ${err}`,
      );
      return false;
    }
  }

  /** Afilia en lote a los prospectos cuyos celulares coinciden con conductores registrados. */
  async afiliarLote(
    celulares: Array<string | null | undefined>,
  ): Promise<AfiliacionStats> {
    const stats: AfiliacionStats = { checked: 0, updated: 0 };
    const unique = [...new Set(celulares.filter((c): c is string => !!c))];
    if (unique.length === 0) return stats;
    try {
      const phones = await this.getRegisteredPhones();
      if (phones.size === 0) return stats;
      const matched = unique.filter((cel) => {
        const norm = normalizarTelefono(cel);
        return norm.length >= 6 && phones.has(norm);
      });
      stats.checked = unique.length;
      if (matched.length === 0) return stats;

      const prospects = await this.prisma.flotaProspecto.findMany({
        where: {
          celular: { in: matched },
          eliminadoAt: null,
          estado: { not: 'Afiliado' },
        },
        select: { id: true, nombreCompleto: true },
      });
      for (const p of prospects) {
        await this.marcarAfiliado(p.id);
        stats.updated += 1;
      }
    } catch (err) {
      this.logger.error(`afiliarLote falló: ${err}`);
    }
    return stats;
  }

  /** Backfill: recorre los prospectos no afiliados y afilia los que matcheen. */
  async backfillAfiliados(batchSize = 500): Promise<AfiliacionStats> {
    const stats: AfiliacionStats = { checked: 0, updated: 0 };
    const phones = await this.getRegisteredPhones();
    if (phones.size === 0) return stats;

    let cursor = '';
    for (;;) {
      const rows = await this.prisma.flotaProspecto.findMany({
        where: {
          eliminadoAt: null,
          estado: { not: 'Afiliado' },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: { id: true, celular: true, nombreCompleto: true },
        orderBy: { id: 'asc' },
        take: batchSize,
      });
      if (rows.length === 0) break;
      for (const row of rows) {
        stats.checked += 1;
        const norm = row.celular ? normalizarTelefono(row.celular) : '';
        if (norm.length >= 6 && phones.has(norm)) {
          await this.marcarAfiliado(row.id);
          stats.updated += 1;
        }
      }
      cursor = rows[rows.length - 1].id;
    }
    return stats;
  }

  private async marcarAfiliado(id: string) {
    const updated = await this.prisma.flotaProspecto.update({
      where: { id },
      data: { estado: 'Afiliado', fechaAfiliacion: limaDate() },
      select: { id: true, nombreCompleto: true },
    });
    try {
      await this.activityLogs.record(null, {
        action: 'cambiar_etapa',
        module: 'flota',
        entityType: 'flota-prospecto',
        entityId: id,
        entityName: updated.nombreCompleto,
        description:
          'Afiliación automática por match con conductor registrado.',
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo registrar historial de afiliación ${id}: ${err}`,
      );
    }
    this.prospectosGateway.emitChange('updated', id);
  }
}
