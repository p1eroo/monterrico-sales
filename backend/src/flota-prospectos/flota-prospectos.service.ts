import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleSheetsService, type SheetsSpreadsheet } from './google-sheets.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { ActivityActor } from '../activity-logs/activity-logs.types';
import { AuditDetailService } from '../audit-detail/audit-detail.service';
import { FLOTA_PROSPECTO_FIELD_LABELS } from '../audit-detail/audit-field-labels';
import { buildChangeEntries } from '../common/audit-diff.util';
import { ChatwootOperadorSyncService } from '../chatwoot/chatwoot-operador-sync.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import type { ImportJobProgressInput } from '../import-export/import-export-jobs.service';
import type { BulkImportResultDto, BulkImportRowError } from '../import-export/import-export.service';

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').trim();
}

function getInitials(s: string): string {
  return s.split(/\s+/).map(w => w[0] || '').join('').toLowerCase();
}

/** Mapeo de columnas del Google Sheet (basado en la captura del usuario). */
// Columnas: N° | F. REGISTRO | RED SOCIAL | CELULAR | APELLIDOS Y NOMBRES | EDAD | OPERADOR | ESTADO | MODALIDAD | AÑO VEH. | DISTRITO | F. CITA | ASISTENCIA | F AFILIACION | MOVIL | OBSERVACIONES
const COL = {
  NUMERO: 0,
  FECHA_REGISTRO: 1,
  RED_SOCIAL: 2,
  CELULAR: 3,
  NOMBRE_COMPLETO: 4,
  EDAD: 5,
  OPERADOR: 6,
  ESTADO: 7,
  MODALIDAD: 8,
  ANIO_VEHICULO: 9,
  PLACA: 10,
  DISTRITO: 11,
  FECHA_CITA: 12,
  ASISTENCIA: 13,
  FECHA_AFILIACION: 14,
  MOVIL: 15,
  OBSERVACIONES: 17,
};

function cell(row: string[], idx: number): string {
  return (row[idx] ?? '').toString().trim();
}

/** Retorna la fecha actual a medianoche UTC usando la fecha local de Lima.
 *  Evita que Prisma/PostgreSQL desfase el día por la timezone del servidor. */
function limaDate(): Date {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  return new Date(dateStr + 'T00:00:00.000Z');
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  // Intentar yyyy-mm-dd (ISO) primero
  const isoMatch = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const d = new Date(Date.UTC(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10) - 1,
      parseInt(isoMatch[3], 10),
    ));
    if (!isNaN(d.getTime())) return d;
  }
  // Intentar dd/mm/yyyy o dd-mm-yyyy (LATAM)
  const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = dmyMatch[3]
      ? parseInt(dmyMatch[3], 10) < 100
        ? 2000 + parseInt(dmyMatch[3], 10)
        : parseInt(dmyMatch[3], 10)
      : new Date().getFullYear();
    // Usamos Date.UTC para evitar que la zona horaria mueva el día
    const d = new Date(Date.UTC(year, month, day));
    if (!isNaN(d.getTime())) return d;

  }
  // Intentar yyyy-mm-dd (ISO)
  const iso = new Date(raw);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function parseInt10(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function latestObservacionText(obs: string | null | undefined): string {
  if (!obs) return '';
  const first = obs.split(/\n?---\n?/)[0];
  return first.replace(/^(?:\[.+?\]\s*)+/, '').trim();
}

const ESTADOS_VALIDOS = ['Nuevo', 'Afiliado', 'Citado', 'Seguimiento', 'Informacion', 'Sin Requisitos', 'No Responde'];

function normalizeEstado(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return 'Nuevo';
  const match = ESTADOS_VALIDOS.find((e) => e.toLowerCase() === cleaned.toLowerCase());
  return match || 'Nuevo';
}

export interface ImportSheetsResult {
  total: number;
  imported: number;
  updated: number;
  duplicates: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class FlotaProspectosService {
  private readonly logger = new Logger(FlotaProspectosService.name);

  constructor(
    private prisma: PrismaService,
    private googleSheets: GoogleSheetsService,
    private activityLogs: ActivityLogsService,
    private auditDetail: AuditDetailService,
    private operadorSync: ChatwootOperadorSyncService,
  ) {}

  private normalizeCelular(celular?: string | null): string | null {
    if (!celular) return null;
    const digits = celular.replace(/\D/g, '');
    return digits.slice(-9) || null;
  }

  /** Buscar prospecto por celular normalizado */
  async findByPhone(phone: string): Promise<{
    id: string; nombreCompleto: string; celular: string | null; operador: string | null; estado: string;
    edad?: number | null; modalidad?: string | null; placa?: string | null; anioVehiculo?: number | null;
    distrito?: string | null; fechaCita?: Date | null; movil?: string | null; observaciones?: string | null;
    asistencia?: string | null; llamadaCount?: number;
    eliminadoAt?: Date | null;
  } | null> {
    const norm = this.normalizeCelular(phone);
    if (!norm) return null;
    const prospecto = await this.prisma.flotaProspecto.findFirst({
      where: {
        OR: [
          { celular: { endsWith: norm } },
          { movil: { endsWith: norm } },
        ],
      },
      include: { _count: { select: { llamadas: true } } },
    });
    if (!prospecto) return null;
    return {
      id: prospecto.id,
      nombreCompleto: prospecto.nombreCompleto,
      celular: prospecto.celular,
      operador: prospecto.operador,
      estado: prospecto.estado,
      edad: prospecto.edad,
      modalidad: prospecto.modalidad,
      placa: prospecto.placa,
      anioVehiculo: prospecto.anioVehiculo,
      distrito: prospecto.distrito,
      fechaCita: prospecto.fechaCita,
      movil: prospecto.movil,
      observaciones: prospecto.observaciones,
      asistencia: prospecto.asistencia,
      llamadaCount: prospecto._count?.llamadas ?? 0,
      eliminadoAt: prospecto.eliminadoAt,
    };
  }


  /** Lista ligera para el envío masivo desde CRM */
  async listForMasivo(search?: string, scope?: CrmDataScope, estado?: string) {
    const where: Record<string, unknown> = {
      eliminadoAt: null,
    };

    if (scope && !scope.unrestricted) {
      const operadorFilter = await this.getScopeOperadorFilter(scope.viewerUserId);
      if (operadorFilter) {
        where.AND = [{ OR: [operadorFilter, { operador: null }] }] as any;
      }
    }

    if (estado) {
      where.estado = { equals: estado, mode: 'insensitive' };
    }

    if (search?.trim()) {
      const s = search.trim();
      where.OR = [
        { nombreCompleto: { contains: s, mode: 'insensitive' } },
        { celular: { contains: s, mode: 'insensitive' } },
      ];
    }
    return this.prisma.flotaProspecto.findMany({
      where: where as any,
      select: { id: true, nombreCompleto: true, celular: true, movil: true, estado: true },
      orderBy: { nombreCompleto: 'asc' },
      take: 20000,
    });
  }

  private async getScopeOperadorFilter(userId: string): Promise<Record<string, unknown> | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (!user?.name) return null;

    const account = await this.prisma.account.findFirst({
      where: { userId, provider: 'credentials' },
      select: { providerId: true },
    });
    const username = account?.providerId || null;

    const distinctOps = await this.prisma.flotaProspecto.findMany({
      where: { operador: { not: null } },
      select: { operador: true },
      distinct: ['operador'],
    });

    const userLower = user.name.toLowerCase().trim();
    const normUser = normalizeStr(user.name);
    const nameParts = userLower.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const initials = getInitials(user.name);

    const matching = [user.name];

    for (const op of distinctOps) {
      if (!op.operador) continue;
      const v = op.operador.trim();
      const vLower = v.toLowerCase();
      const normOp = normalizeStr(v);

      if (vLower === userLower) { matching.push(v); continue; }
      if (normOp === normUser) { matching.push(v); continue; }
      if (normOp.includes(normUser) || normUser.includes(normOp)) { matching.push(v); continue; }
      if (vLower === firstName || normOp === firstName) { matching.push(v); continue; }
      if (lastName && (vLower === lastName || normOp === lastName)) { matching.push(v); continue; }
      if (firstName && vLower.includes(firstName)) { matching.push(v); continue; }
      if (lastName && vLower.includes(lastName)) { matching.push(v); continue; }
      if (vLower === initials) { matching.push(v); continue; }
      if (username) {
        const normUsername = normalizeStr(username);
        if (normOp.includes(normUsername) || normUsername.includes(normOp)) { matching.push(v); continue; }
        if (vLower.startsWith(normUsername) || normUsername.startsWith(vLower)) { matching.push(v); continue; }
      }
    }

    const unique = [...new Set(matching)];
    return unique.length === 1 && unique[0] === user.name
      ? { operador: user.name }
      : { operador: { in: unique } };
  }

  /** Lista paginada con filtros */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    estado?: string;
    duplicados?: boolean;
    mes?: string;
    mesImport?: string;
    fechaRegistroDesde?: string;
    fechaRegistroHasta?: string;
    mesImportDesde?: string;
    mesImportHasta?: string;
    redSocial?: string;
    operador?: string;
    filters?: string;
    conLlamadas?: string;
  }, scope?: CrmDataScope) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      eliminadoAt: null,
    };

    // "Sin asignar" filter overrides all operador-based scoping
    if (params.operador === '__unassigned__') {
      where.operador = null;
    } else {
      // Apply data scope: if restricted, only show prospects matching this user or unassigned
      if (scope && !scope.unrestricted) {
        const operadorFilter = await this.getScopeOperadorFilter(scope.viewerUserId);
        if (operadorFilter) {
          where.AND = [{ OR: [operadorFilter, { operador: null }] }] as any;
        }
      }

      if (params.operador) {
        if (scope && !scope.unrestricted) {
          // scope already set in AND above
        } else {
          const aliases = params.operador.split(',').map(s => s.trim()).filter(Boolean);
          const orConditions = aliases.map(a => ({ operador: { contains: a, mode: 'insensitive' } }));
          if ((where.OR as any[])?.length > 0) {
            (where.OR as any[]).push(...orConditions);
          } else {
            where.OR = orConditions;
          }
        }
      }
    }

    if (params.estado) {
      where.estado = normalizeEstado(params.estado);
    }

    if (params.redSocial) {
      where.redSocial = params.redSocial;
    }

    if (params.duplicados) {
      where.esDuplicado = true;
    }

    if (params.conLlamadas === 'true') {
      where.llamadas = { some: {} };
    } else if (params.conLlamadas === 'false') {
      where.llamadas = { none: {} };
    }

    if (params.mes) {
      const [yearStr, monthStr] = params.mes.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      
      where.fechaRegistro = {
        gte: startDate,
        lt: endDate,
      };
    }

    if (params.mesImport) {
      const [yearStr, monthStr] = params.mesImport.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      
      where.createdAt = {
        gte: startDate,
        lt: endDate,
      };
    }

    if (params.fechaRegistroDesde) {
      where.fechaRegistro = {
        ...(where.fechaRegistro as object || {}),
        gte: new Date(params.fechaRegistroDesde + "T00:00:00.000Z"),
      };
    }
    if (params.fechaRegistroHasta) {
      where.fechaRegistro = {
        ...(where.fechaRegistro as object || {}),
        lte: new Date(params.fechaRegistroHasta + "T23:59:59.999Z"),
      };
    }
    if (params.mesImportDesde) {
      where.createdAt = {
        ...(where.createdAt as object || {}),
        gte: new Date(params.mesImportDesde + "T00:00:00.000Z"),
      };
    }
    if (params.mesImportHasta) {
      where.createdAt = {
        ...(where.createdAt as object || {}),
        lte: new Date(params.mesImportHasta + "T23:59:59.999Z"),
      };
    }

    if (params.search) {
      const s = params.search;
      where.OR = [
        { nombreCompleto: { contains: s, mode: 'insensitive' } },
        { celular: { contains: s, mode: 'insensitive' } },
        { distrito: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (params.filters) {
      try {
        const parsed = JSON.parse(params.filters) as Record<string, string>;
        for (const [key, value] of Object.entries(parsed)) {
          if (value && key !== 'filters') {
            (where as any)[key] = { contains: value, mode: 'insensitive' };
          }
        }
      } catch { /* ignore invalid JSON */ }
    }

    const [data, total] = await Promise.all([
      this.prisma.flotaProspecto.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { llamadas: true } },
        },
      }),
      this.prisma.flotaProspecto.count({ where: where as any }),
    ]);

    return { data, total, page, limit };
  }

  /** Obtener un prospecto por ID */
  async findOne(id: string) {
    return this.prisma.flotaProspecto.findUnique({ where: { id } });
  }

  /** Actualizar un prospecto (ignora campo operador) */
  async update(id: string, data: Record<string, unknown>, actor?: ActivityActor) {
    const existing = await this.prisma.flotaProspecto.findUnique({ where: { id } });
    if (!existing) throw new Error('Prospecto no encontrado');

    const { operador: _ignored, ...safeData } = data;

    // Parse date fields before sending to Prisma
    for (const field of ['fechaCita', 'fechaAfiliacion', 'fechaRegistro'] as const) {
      if (safeData[field] !== undefined && typeof safeData[field] === 'string') {
        safeData[field] = parseDate(safeData[field] as string) || safeData[field];
      }
    }

    // Normalize estado before comparing or saving
    if (safeData.estado && typeof safeData.estado === 'string') {
      safeData.estado = normalizeEstado(safeData.estado as string);
    }

    // Auto-set fechaAfiliacion cuando el estado cambia a Afiliado
    if (safeData.estado === 'Afiliado' && existing.estado !== 'Afiliado' && !safeData.fechaAfiliacion) {
      safeData.fechaAfiliacion = limaDate();
    }

    const updated = await this.prisma.flotaProspecto.update({
      where: { id },
      data: safeData as any,
    });

    // Registrar cambio de estado en el historial
    if (data.estado && data.estado !== existing.estado) {
      await this.activityLogs.record(actor || null, {
        action: 'cambiar_etapa',
        module: 'flota',
        entityType: 'flota-prospecto',
        entityId: id,
        entityName: updated.nombreCompleto,
        description: `Cambio de estado: ${existing.estado} -> ${data.estado}. Comentario: ${data.observaciones || 'Sin comentarios'}`,
      });
    } else if (data.observaciones && data.observaciones !== existing.observaciones) {
      // Si solo cambian observaciones sin cambiar estado
      const oldText = latestObservacionText(existing.observaciones);
      const newText = latestObservacionText(data.observaciones as string);
      const diff = oldText && newText && oldText !== newText ? `${oldText} → ${newText}` : newText || '—';
      await this.activityLogs.record(actor || null, {
        action: 'actualizar',
        module: 'flota',
        entityType: 'flota-prospecto',
        entityId: id,
        entityName: updated.nombreCompleto,
        description: `Observación actualizada: ${diff}`,
      });
    }

    // Registrar cambios campo a campo en auditoría detallada
    const diffEntries = buildChangeEntries(
      existing as any,
      safeData as Record<string, unknown>,
      FLOTA_PROSPECTO_FIELD_LABELS,
      ['asignadoAt'],
    );
    if (diffEntries.length > 0) {
      await this.auditDetail.record(actor || null, {
        action: data.estado && data.estado !== existing.estado ? 'cambiar_etapa' : 'actualizar',
        module: 'flota',
        entityType: 'flota-prospecto',
        entityId: id,
        entityName: updated.nombreCompleto,
        entries: diffEntries,
      });
    }

    return updated;
  }

  /** Asignar operador a un prospecto (endpoint dedicado) */
  async updateOperador(id: string, operador: string | null | undefined, actor?: ActivityActor) {
    const existing = await this.prisma.flotaProspecto.findUnique({ where: { id } });
    if (!existing) throw new Error('Prospecto no encontrado');

    const ops = await this.operadorSync.listOperadores();
    const raw = operador?.trim() || null;
    const val = raw ? (this.operadorSync.resolveOperadorName(raw, ops) ?? raw) : null;

    const updated = await this.prisma.flotaProspecto.update({
      where: { id },
      data: { operador: val, asignadoAt: val ? limaDate() : null },
    });

    await this.activityLogs.record(actor || null, {
      action: 'asignar',
      module: 'flota',
      entityType: 'flota-prospecto',
      entityId: id,
      entityName: updated.nombreCompleto,
      description: val
        ? `Operador asignado: ${val}`
        : 'Operador removido',
    });

    await this.operadorSync.syncAssigneeFromOperador(id, val);

    return updated;
  }

  /** Crear un nuevo prospecto — si ya existe uno eliminado, lo reactiva */
  async createOne(data: Record<string, unknown>, actor?: ActivityActor) {
    // Normalizar teléfono a E.164 (+51 + 9 dígitos)
    if (data.celular) {
      const digits = String(data.celular).replace(/\D/g, '');
      data.celular = digits.length === 9 ? `+51${digits}` : digits.length === 11 && digits.startsWith('51') ? `+${digits}` : String(data.celular);
    }
    const rawPhone = String(data.celular || data.movil || '');
    const existingByPhone = await this.findByPhone(rawPhone);
    if (existingByPhone) {
      const prospecto = await this.prisma.flotaProspecto.findUnique({
        where: { id: existingByPhone.id },
        select: { eliminadoAt: true },
      });
      // Si el prospecto existente está eliminado, reactivarlo
      if (prospecto?.eliminadoAt) {
        const updated = await this.prisma.flotaProspecto.update({
          where: { id: existingByPhone.id },
          data: {
            ...data as any,
            eliminadoAt: null,
            fechaRegistro: data.fechaRegistro ? new Date(data.fechaRegistro as string) : limaDate(),
            fechaCita: data.fechaCita ? new Date(data.fechaCita as string) : null,
            fechaAfiliacion: data.fechaAfiliacion ? new Date(data.fechaAfiliacion as string) : null,
            asignadoAt: data.operador ? limaDate() : null,
          },
        });
        await this.activityLogs.record(actor || null, {
          action: 'reactivar',
          module: 'flota',
          entityType: 'flota-prospecto',
          entityId: updated.id,
          entityName: updated.nombreCompleto,
          description: `Prospecto reactivado: ${updated.nombreCompleto} (${updated.celular || ''})`,
        });
        return updated;
      }
      const operadorName = existingByPhone.operador?.trim() || null;
      const msg = operadorName
        ? `Ya existe un prospecto con el celular ${rawPhone} (${existingByPhone.nombreCompleto}) asignado a ${operadorName}`
        : `Ya existe un prospecto con el celular ${rawPhone} (${existingByPhone.nombreCompleto})`;
      throw new ConflictException({
        message: msg,
        existing: existingByPhone,
      });
    }
    const created = await this.prisma.flotaProspecto.create({
      data: {
        ...data as any,
        fechaRegistro: data.fechaRegistro ? new Date(data.fechaRegistro as string) : limaDate(),
        fechaCita: data.fechaCita ? new Date(data.fechaCita as string) : null,
        fechaAfiliacion: data.fechaAfiliacion ? new Date(data.fechaAfiliacion as string) : null,
        asignadoAt: data.operador ? limaDate() : null,
      },
    });
    await this.activityLogs.record(actor || null, {
      action: 'crear',
      module: 'flota',
      entityType: 'flota-prospecto',
      entityId: created.id,
      entityName: created.nombreCompleto,
      description: `Prospecto creado: ${created.nombreCompleto} (${created.celular || ''})`,
    });
    return created;
  }

  /** Soft delete (marcar como eliminado en vez de borrar físicamente) */
  async remove(id: string, actor?: ActivityActor) {
    const existing = await this.prisma.flotaProspecto.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Prospecto no encontrado: ${id}`);
    }
    await this.prisma.flotaProspecto.update({
      where: { id },
      data: { eliminadoAt: new Date() },
    });
    await this.activityLogs.record(actor || null, {
      action: 'eliminar',
      module: 'flota',
      entityType: 'flota-prospecto',
      entityId: id,
      entityName: existing.nombreCompleto,
      description: `Prospecto eliminado: ${existing.nombreCompleto} (${existing.celular || ''})`,
    });
  }

  /** Soft delete múltiples prospectos */
  async removeMany(ids: string[], actor?: ActivityActor) {
    if (!ids || ids.length === 0) {
      throw new Error('No se proporcionaron IDs');
    }
    const result = await this.prisma.flotaProspecto.updateMany({
      where: { id: { in: ids } },
      data: { eliminadoAt: new Date() },
    });
    await this.activityLogs.record(actor || null, {
      action: 'eliminar',
      module: 'flota',
      entityType: 'flota-prospecto',
      description: `${result.count} prospecto(s) eliminado(s) en lote`,
    });
    return result.count;
  }

  /** Obtener spreadsheets configurados */
  getSpreadsheets(): SheetsSpreadsheet[] {
    return this.googleSheets.getSpreadsheets();
  }

  /** Obtener nombres de hojas del spreadsheet */
  async getSheetNames(spreadsheetId?: string): Promise<string[]> {
    return this.googleSheets.getSheetNames(spreadsheetId);
  }

  /** Obtiene las primeras 15 filas para vista previa */
  async getPreview(sheetName: string, spreadsheetId?: string) {
    const rawRows = await this.googleSheets.readAllRows(sheetName, spreadsheetId);
    if (rawRows.length === 0) {
      return { headers: [], rows: [], totalRows: 0 };
    }

    const { headers, dataRows } = this.findHeaderAndData(rawRows);

    // Mapear las filas (con un tope de seguridad de 1000 para no romper el navegador)
    const previewRows = dataRows.slice(0, 1000).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = String(r[i] || '');
      });
      return obj;
    });

    return {
      headers: headers.filter(Boolean),
      rows: previewRows,
      totalRows: dataRows.length,
    };

  }


  /** Helper para detectar cabecera y crear un mapa de índices de columnas */
  private findHeaderAndData(rawRows: string[][]) {
    const headerIndex = rawRows.findIndex((r) =>
      r.some((c) => {
        const text = String(c || '').toUpperCase();
        return (
          text.includes('CELULAR') ||
          text.includes('NOMBRE') ||
          text.includes('APELLIDOS')
        );
      }),
    );

    if (headerIndex === -1) {
      throw new Error(
        'No se encontró la cabecera en la hoja (ej. "CELULAR" o "NOMBRES")',
      );
    }

    const rawHeaders = rawRows[headerIndex].map((h) =>
      String(h || '')
        .trim()
        .toUpperCase()
        .replace(/_/g, ' '),
    );

    // Mapa dinámico de columnas
    const col = {
      FECHA_REGISTRO: rawHeaders.findIndex(
        (h) => h.includes('REGISTRO') || h.includes('FECHA R'),
      ),
      RED_SOCIAL: rawHeaders.findIndex((h) => h.includes('RED SOCIAL')),
      CELULAR: rawHeaders.findIndex((h) => h.includes('CELULAR')),
      NOMBRE_COMPLETO: rawHeaders.findIndex(
        (h) =>
          h.includes('NOMBRE') ||
          h.includes('APELLIDOS') ||
          h.includes('PROSPECTO'),
      ),
      EDAD: rawHeaders.findIndex((h) => h.includes('EDAD')),
      OPERADOR: rawHeaders.findIndex((h) => h.includes('OPERADOR')),
      ESTADO: rawHeaders.findIndex((h) => h.includes('ESTADO')),
      MODALIDAD: rawHeaders.findIndex((h) => h.includes('MODALIDAD')),
      ANIO_VEHICULO: rawHeaders.findIndex(
        (h) => h.includes('AÑO') || h.includes('ANIO'),
      ),
      PLACA: rawHeaders.findIndex((h) => h.includes('PLACA')),
      DISTRITO: rawHeaders.findIndex((h) => h.includes('DISTRITO')),
      FECHA_CITA: rawHeaders.findIndex((h) => h.includes('CITA')),
      ASISTENCIA: rawHeaders.findIndex((h) => h.includes('ASISTENCIA')),
      FECHA_AFILIACION: rawHeaders.findIndex((h) => h.includes('AFILIACION')),
      MOVIL: rawHeaders.findIndex((h) => h.includes('MOVIL') && h !== 'CELULAR'),
      OBSERVACIONES: rawHeaders.findIndex((h) => h.includes('OBSERV')),
    };

    const dataRows = rawRows.slice(headerIndex + 1).filter((row) => {
      return row.some((cell) => String(cell || '').trim() !== '');
    });

    return { headers: rawRows[headerIndex], dataRows, col };
  }


  /**
   * Importar prospectos desde Google Sheets.
   * 1. Lee todas las filas del sheet indicado (o el primero).
   * 2. Mapea cada fila al modelo FlotaProspecto.
   * 3. Detecta duplicados por celular y los marca con esDuplicado=true.
   * 4. Inserta todo en la BD.
   */
  async importFromSheets(sheetName?: string, spreadsheetId?: string): Promise<ImportSheetsResult> {
    const result: ImportSheetsResult = {
      total: 0,
      imported: 0,
      updated: 0,
      duplicates: 0,
      skipped: 0,
      errors: [],
    };

    // 1. Leer filas del Google Sheet
    let rawRows: string[][];
    try {
      rawRows = await this.googleSheets.readAllRows(sheetName, spreadsheetId);
    } catch (err) {
      this.logger.error('Error leyendo Google Sheet', err);
      throw new Error(
        `No se pudo leer el Google Sheet: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (rawRows.length === 0) return result;

    // Detectar cabecera y filtrar datos
    const { dataRows, col } = this.findHeaderAndData(rawRows);
    result.total = dataRows.length;
    if (dataRows.length === 0) return result;

    // Extraer todos los celulares normalizados del sheet para filtrar la consulta de existentes
    const sheetPhones = new Set<string>();
    for (const row of dataRows) {
      const cel = col.CELULAR !== -1 ? cell(row, col.CELULAR) : cell(row, col.MOVIL);
      const norm = this.normalizeCelular(cel);
      if (norm) sheetPhones.add(norm);
    }

    // 2. Obtener solo los prospectos existentes cuyos celulares aparecen en el sheet
    const existingProspectos = new Map<string, { id: string; estado: string }>();
    if (sheetPhones.size > 0) {
      const existingRows = await this.prisma.flotaProspecto.findMany({
        where: { celular: { not: null } },
        select: { id: true, celular: true, estado: true },
      });
      for (const r of existingRows) {
        const norm = this.normalizeCelular(r.celular);
        if (norm && sheetPhones.has(norm)) {
          existingProspectos.set(norm, { id: r.id, estado: r.estado });
        }
      }
    }

    const batchPhones = new Map<string, number>();

    // 3. Mapear y preparar registros
    const records: any[] = [];
    const updateBatch: Array<{ id: string; data: Record<string, unknown> }> = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const nombre =
        col.NOMBRE_COMPLETO !== -1 ? cell(row, col.NOMBRE_COMPLETO) : '';
      const celular =
        col.CELULAR !== -1 ? cell(row, col.CELULAR) : cell(row, col.MOVIL);
      const celularNorm = this.normalizeCelular(celular) || '';

      // Skip if both celular and nombre are empty
      if (!celularNorm && !nombre) {
        result.skipped++;
        result.errors.push(`Fila ${i + 1}: Omitida por falta de nombre y celular.`);
        continue;
      }

      // Detectar duplicado y actualizar datos si ya existe
      let esDuplicado = false;
      if (celularNorm) {
        if (existingProspectos.has(celularNorm) || batchPhones.has(celularNorm)) {
          esDuplicado = true;
        }
        if (!esDuplicado) {
          batchPhones.set(celularNorm, records.length);
        }
      }

      if (esDuplicado) {
        const existing = existingProspectos.get(celularNorm);
        if (existing && celularNorm) {
          const updateData: Record<string, unknown> = {};
          if (nombre) updateData.nombreCompleto = nombre;
          if (col.RED_SOCIAL !== -1) {
            const val = cell(row, col.RED_SOCIAL);
            if (val) updateData.redSocial = val;
          }
          if (col.EDAD !== -1) {
            const val = parseInt10(cell(row, col.EDAD));
            if (val !== null) updateData.edad = val;
          }
          if (col.OPERADOR !== -1) {
            const val = cell(row, col.OPERADOR);
            if (val) { updateData.operador = val; updateData.asignadoAt = limaDate(); }
          }
          if (col.ESTADO !== -1) {
            const val = cell(row, col.ESTADO);
            if (val) updateData.estado = normalizeEstado(val);
          }
          if (col.MODALIDAD !== -1) {
            const val = cell(row, col.MODALIDAD);
            if (val) updateData.modalidad = val;
          }
          if (col.ANIO_VEHICULO !== -1) {
            const val = parseInt10(cell(row, col.ANIO_VEHICULO));
            if (val !== null) updateData.anioVehiculo = val;
          }
          if (col.PLACA !== -1) {
            const val = cell(row, col.PLACA);
            if (val) updateData.placa = val;
          }
          if (col.DISTRITO !== -1) {
            const val = cell(row, col.DISTRITO);
            if (val) updateData.distrito = val;
          }
          if (col.FECHA_CITA !== -1) {
            const val = parseDate(cell(row, col.FECHA_CITA));
            if (val) updateData.fechaCita = val;
          }
          if (col.ASISTENCIA !== -1) {
            const val = cell(row, col.ASISTENCIA);
            if (val) updateData.asistencia = val;
          }
          if (col.FECHA_AFILIACION !== -1) {
            const val = parseDate(cell(row, col.FECHA_AFILIACION));
            if (val) updateData.fechaAfiliacion = val;
          }
          if (col.MOVIL !== -1) {
            const val = cell(row, col.MOVIL);
            if (val) updateData.movil = val;
          }
          if (col.OBSERVACIONES !== -1) {
            const val = cell(row, col.OBSERVACIONES);
            if (val) updateData.observaciones = val;
          }
          if (col.FECHA_REGISTRO !== -1) {
            const val = parseDate(cell(row, col.FECHA_REGISTRO));
            if (val) updateData.fechaRegistro = val;
          }
          if (Object.keys(updateData).length > 0) {
            updateBatch.push({ id: existing.id, data: updateData });
            if (updateBatch.length >= 100) {
              const batch = [...updateBatch];
              updateBatch.length = 0;
              await this.prisma.$transaction(async (tx) => {
                await Promise.all(
                  batch.map(({ id, data }) => tx.flotaProspecto.update({ where: { id }, data: data as any })),
                );
              }, { timeout: 30000 });
              result.updated += batch.length;
              updateBatch.length = 0;
            }
          } else {
            result.duplicates++;
          }
        } else {
          const batchIdx = batchPhones.get(celularNorm);
          if (batchIdx !== undefined) {
            const rec = records[batchIdx];
            if (nombre) rec.nombreCompleto = nombre;
            if (col.RED_SOCIAL !== -1) {
              const val = cell(row, col.RED_SOCIAL);
              if (val) rec.redSocial = val;
            }
            if (col.EDAD !== -1) {
              const val = parseInt10(cell(row, col.EDAD));
              if (val !== null) rec.edad = val;
            }
            if (col.OPERADOR !== -1) {
              const val = cell(row, col.OPERADOR);
              if (val) rec.operador = val;
            }
            if (col.ESTADO !== -1) {
              const val = cell(row, col.ESTADO);
              if (val) rec.estado = normalizeEstado(val);
            }
            if (col.MODALIDAD !== -1) {
              const val = cell(row, col.MODALIDAD);
              if (val) rec.modalidad = val;
            }
            if (col.ANIO_VEHICULO !== -1) {
              const val = parseInt10(cell(row, col.ANIO_VEHICULO));
              if (val !== null) rec.anioVehiculo = val;
            }
            if (col.PLACA !== -1) {
              const val = cell(row, col.PLACA);
              if (val) rec.placa = val;
            }
            if (col.DISTRITO !== -1) {
              const val = cell(row, col.DISTRITO);
              if (val) rec.distrito = val;
            }
            if (col.FECHA_CITA !== -1) {
              const val = parseDate(cell(row, col.FECHA_CITA));
              if (val) rec.fechaCita = val;
            }
            if (col.ASISTENCIA !== -1) {
              const val = cell(row, col.ASISTENCIA);
              if (val) rec.asistencia = val;
            }
            if (col.FECHA_AFILIACION !== -1) {
              const val = parseDate(cell(row, col.FECHA_AFILIACION));
              if (val) rec.fechaAfiliacion = val;
            }
            if (col.MOVIL !== -1) {
              const val = cell(row, col.MOVIL);
              if (val) rec.movil = val;
            }
            if (col.OBSERVACIONES !== -1) {
              const val = cell(row, col.OBSERVACIONES);
              if (val) rec.observaciones = val;
            }
            if (col.FECHA_REGISTRO !== -1) {
              const val = parseDate(cell(row, col.FECHA_REGISTRO));
              if (val) rec.fechaRegistro = val;
            }
            result.updated++;
          } else {
            result.duplicates++;
            result.errors.push(`Fila ${i + 1}: Omitida por duplicado (Celular: ${celularNorm || celular}).`);
          }
        }
        continue;
      }

      const estadoRaw = col.ESTADO !== -1 ? cell(row, col.ESTADO) : '';

      const estado = normalizeEstado(estadoRaw);

      records.push({
        fechaRegistro:
          col.FECHA_REGISTRO !== -1
            ? parseDate(cell(row, col.FECHA_REGISTRO))
            : null,
        redSocial:
          col.RED_SOCIAL !== -1 ? cell(row, col.RED_SOCIAL) || null : null,
        celular: celularNorm ? `+51${celularNorm}` : null,
        nombreCompleto: nombre,
        edad: col.EDAD !== -1 ? parseInt10(cell(row, col.EDAD)) : null,
        operador: col.OPERADOR !== -1 ? cell(row, col.OPERADOR) || null : null,
        estado,
        asignadoAt: col.OPERADOR !== -1 && cell(row, col.OPERADOR) ? limaDate() : null,
        modalidad:
          col.MODALIDAD !== -1 ? cell(row, col.MODALIDAD) || null : null,
        anioVehiculo:
          col.ANIO_VEHICULO !== -1 ? parseInt10(cell(row, col.ANIO_VEHICULO)) : null,
        placa:
          col.PLACA !== -1 ? cell(row, col.PLACA) || null : null,
        distrito: col.DISTRITO !== -1 ? cell(row, col.DISTRITO) || null : null,
        fechaCita:
          col.FECHA_CITA !== -1 ? parseDate(cell(row, col.FECHA_CITA)) : null,
        asistencia:
          col.ASISTENCIA !== -1 ? cell(row, col.ASISTENCIA) || null : null,
        fechaAfiliacion:
          col.FECHA_AFILIACION !== -1
            ? parseDate(cell(row, col.FECHA_AFILIACION))
            : null,
        movil: col.MOVIL !== -1 ? cell(row, col.MOVIL) || null : null,
        observaciones:
          col.OBSERVACIONES !== -1
            ? cell(row, col.OBSERVACIONES) || null
            : null,
        esDuplicado,
        origen: "IMPORTADO",
      });
    }

    // Flush remaining updates
    if (updateBatch.length > 0) {
      const batch = [...updateBatch];
      updateBatch.length = 0;
      await this.prisma.$transaction(async (tx) => {
        await Promise.all(
          batch.map(({ id, data }) => tx.flotaProspecto.update({ where: { id }, data: data as any })),
        );
      }, { timeout: 30000 });
      result.updated += batch.length;
    }

    // 4. Insertar en lotes de 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      try {
        await this.prisma.flotaProspecto.createMany({ data: batch as any });
        result.imported += batch.length;
      } catch (err) {
        const msg = `Error insertando lote ${Math.floor(i / BATCH_SIZE) + 1}: ${err instanceof Error ? err.message : String(err)}`;
        this.logger.error(msg);
        result.errors.push(msg);
      }
    }

    this.logger.log(
      `Importación completada: ${result.imported} importados, ${result.updated} actualizados, ${result.duplicates} duplicados sin cambios, ${result.skipped} omitidos`,
    );

    return result;
  }

  /** Importar desde filas enviadas directamente (archivo local) */
  async importRowsWithProgress(
    rows: string[][],
    update: (progress: ImportJobProgressInput) => void,
    actor?: ActivityActor,
  ): Promise<BulkImportResultDto> {
    const errors: BulkImportRowError[] = [];
    const sampleNames: string[] = [];

    if (rows.length < 2) {
      return { totalRows: 0, created: 0, skipped: 0, errors };
    }

    const { dataRows, col } = this.findHeaderAndData(rows);
    const totalRows = dataRows.length;
    if (totalRows === 0) return { totalRows: 0, created: 0, skipped: 0, errors };

    const sheetPhones = new Set<string>();
    for (const row of dataRows) {
      const cel = col.CELULAR !== -1 ? cell(row, col.CELULAR) : cell(row, col.MOVIL);
      const norm = this.normalizeCelular(cel);
      if (norm) sheetPhones.add(norm);
    }

    const existingProspectos = new Map<string, { id: string; estado: string }>();
    if (sheetPhones.size > 0) {
      const existingRows = await this.prisma.flotaProspecto.findMany({
        where: { celular: { not: null } },
        select: { id: true, celular: true, estado: true },
      });
      for (const r of existingRows) {
        const norm = this.normalizeCelular(r.celular);
        if (norm && sheetPhones.has(norm)) {
          existingProspectos.set(norm, { id: r.id, estado: r.estado });
        }
      }
    }

    const batchPhones = new Map<string, number>();
    const records: any[] = [];
    const updateBatch: Array<{ id: string; data: Record<string, unknown> }> = [];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const nombre = col.NOMBRE_COMPLETO !== -1 ? cell(row, col.NOMBRE_COMPLETO) : '';
      const celular = col.CELULAR !== -1 ? cell(row, col.CELULAR) : cell(row, col.MOVIL);
      const celularNorm = this.normalizeCelular(celular) || '';
      if (nombre && sampleNames.length < 5) sampleNames.push(nombre);

      if (!celularNorm && !nombre) {
        skipped++;
        errors.push({ row: i + 1, message: 'Omitida por falta de nombre y celular.' });
        continue;
      }

      let esDuplicado = false;
      if (celularNorm) {
        if (existingProspectos.has(celularNorm) || batchPhones.has(celularNorm)) {
          esDuplicado = true;
        }
        if (!esDuplicado) {
          batchPhones.set(celularNorm, records.length);
        }
      }

      if (esDuplicado) {
        const existing = existingProspectos.get(celularNorm);
        if (existing && celularNorm) {
          const updateData: Record<string, unknown> = {};
          if (nombre) updateData.nombreCompleto = nombre;
          if (col.RED_SOCIAL !== -1) { const val = cell(row, col.RED_SOCIAL); if (val) updateData.redSocial = val; }
          if (col.EDAD !== -1) { const val = parseInt10(cell(row, col.EDAD)); if (val !== null) updateData.edad = val; }
          if (col.OPERADOR !== -1) { const val = cell(row, col.OPERADOR); if (val) { updateData.operador = val; updateData.asignadoAt = limaDate(); } }
          if (col.ESTADO !== -1) { const val = cell(row, col.ESTADO); if (val) updateData.estado = normalizeEstado(val); }
          if (col.MODALIDAD !== -1) { const val = cell(row, col.MODALIDAD); if (val) updateData.modalidad = val; }
          if (col.ANIO_VEHICULO !== -1) { const val = parseInt10(cell(row, col.ANIO_VEHICULO)); if (val !== null) updateData.anioVehiculo = val; }
          if (col.PLACA !== -1) { const val = cell(row, col.PLACA); if (val) updateData.placa = val; }
          if (col.DISTRITO !== -1) { const val = cell(row, col.DISTRITO); if (val) updateData.distrito = val; }
          if (col.FECHA_CITA !== -1) { const val = parseDate(cell(row, col.FECHA_CITA)); if (val) updateData.fechaCita = val; }
          if (col.ASISTENCIA !== -1) { const val = cell(row, col.ASISTENCIA); if (val) updateData.asistencia = val; }
          if (col.FECHA_AFILIACION !== -1) { const val = parseDate(cell(row, col.FECHA_AFILIACION)); if (val) updateData.fechaAfiliacion = val; }
          if (col.MOVIL !== -1) { const val = cell(row, col.MOVIL); if (val) updateData.movil = val; }
          if (col.OBSERVACIONES !== -1) { const val = cell(row, col.OBSERVACIONES); if (val) updateData.observaciones = val; }
          if (col.FECHA_REGISTRO !== -1) { const val = parseDate(cell(row, col.FECHA_REGISTRO)); if (val) updateData.fechaRegistro = val; }
          if (Object.keys(updateData).length > 0) {
            updateBatch.push({ id: existing.id, data: updateData });
            if (updateBatch.length >= 100) {
              const batch = [...updateBatch];
              updateBatch.length = 0;
              await this.prisma.$transaction(async (tx) => {
                await Promise.all(
                  batch.map(({ id, data }) => tx.flotaProspecto.update({ where: { id }, data: data as any })),
                );
              }, { timeout: 30000 });
              updated += batch.length;
              update({ processedRows: i + 1, created, updated, skipped, errorCount: errors.length });
            }
          } else {
            skipped++;
          }
        } else {
          skipped++;
          errors.push({ row: i + 1, message: `Omitida por duplicado (Celular: ${celularNorm || celular}).` });
        }
        continue;
      }

      const estadoRaw = col.ESTADO !== -1 ? cell(row, col.ESTADO) : '';
      const estado = normalizeEstado(estadoRaw);

      records.push({
        fechaRegistro: col.FECHA_REGISTRO !== -1 ? parseDate(cell(row, col.FECHA_REGISTRO)) : null,
        redSocial: col.RED_SOCIAL !== -1 ? cell(row, col.RED_SOCIAL) || null : null,
        celular: celularNorm ? `+51${celularNorm}` : null,
        nombreCompleto: nombre,
        edad: col.EDAD !== -1 ? parseInt10(cell(row, col.EDAD)) : null,
        operador: col.OPERADOR !== -1 ? cell(row, col.OPERADOR) || null : null,
        estado,
        asignadoAt: col.OPERADOR !== -1 && cell(row, col.OPERADOR) ? limaDate() : null,
        modalidad: col.MODALIDAD !== -1 ? cell(row, col.MODALIDAD) || null : null,
        anioVehiculo: col.ANIO_VEHICULO !== -1 ? parseInt10(cell(row, col.ANIO_VEHICULO)) : null,
        placa: col.PLACA !== -1 ? cell(row, col.PLACA) || null : null,
        distrito: col.DISTRITO !== -1 ? cell(row, col.DISTRITO) || null : null,
        fechaCita: col.FECHA_CITA !== -1 ? parseDate(cell(row, col.FECHA_CITA)) : null,
        asistencia: col.ASISTENCIA !== -1 ? cell(row, col.ASISTENCIA) || null : null,
        fechaAfiliacion: col.FECHA_AFILIACION !== -1 ? parseDate(cell(row, col.FECHA_AFILIACION)) : null,
        movil: col.MOVIL !== -1 ? cell(row, col.MOVIL) || null : null,
        observaciones: col.OBSERVACIONES !== -1 ? cell(row, col.OBSERVACIONES) || null : null,
        esDuplicado,
        origen: "IMPORTADO",
      });

      if ((i + 1) % 100 === 0) {
        update({ processedRows: i + 1, created, updated, skipped, errorCount: errors.length });
      }
    }

    update({ processedRows: dataRows.length, created, updated, skipped, errorCount: errors.length });

    if (updateBatch.length > 0) {
      const batch = [...updateBatch];
      updateBatch.length = 0;
      await this.prisma.$transaction(async (tx) => {
        await Promise.all(
          batch.map(({ id, data }) => tx.flotaProspecto.update({ where: { id }, data: data as any })),
        );
      }, { timeout: 30000 });
      updated += batch.length;
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      try {
        await this.prisma.flotaProspecto.createMany({ data: batch as any });
        created += batch.length;
      } catch (err) {
        const msg = `Error insertando lote ${Math.floor(i / BATCH_SIZE) + 1}: ${err instanceof Error ? err.message : String(err)}`;
        this.logger.error(msg);
        errors.push({ row: i + 1, message: msg });
      }
      update({ processedRows: dataRows.length, created, updated, skipped, errorCount: errors.length });
    }

    this.logger.log(`Importación desde archivo completada: ${created} creados, ${updated} actualizados, ${skipped} omitidos, ${errors.length} errores`);

    const sampleText = sampleNames.length > 0 ? ` Ej: ${sampleNames.join(', ')}` : '';
    await this.activityLogs.record(actor || null, {
      action: 'importar',
      module: 'flota',
      entityType: 'flota-prospecto',
      description: `Importación desde archivo: ${created} creados, ${updated} actualizados, ${skipped} omitidos, ${errors.length} errores.${sampleText}`,
    });

    return { totalRows, created, skipped, errors };
  }

  /** Importar desde Google Sheets con progreso (para jobs) */
  async importFromSheetsWithProgress(
    sheetName: string,
    update: (progress: ImportJobProgressInput) => void,
    spreadsheetId?: string,
    actor?: ActivityActor,
  ): Promise<BulkImportResultDto> {
    const errors: BulkImportRowError[] = [];
    const sampleNames: string[] = [];

    let rawRows: string[][];
    try {
      rawRows = await this.googleSheets.readAllRows(sheetName, spreadsheetId);
    } catch (err) {
      throw new Error(
        `No se pudo leer el Google Sheet: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (rawRows.length === 0) {
      return { totalRows: 0, created: 0, skipped: 0, errors };
    }

    const { dataRows, col } = this.findHeaderAndData(rawRows);
    const totalRows = dataRows.length;
    if (totalRows === 0) return { totalRows: 0, created: 0, skipped: 0, errors };

    const sheetPhones = new Set<string>();
    for (const row of dataRows) {
      const cel = col.CELULAR !== -1 ? cell(row, col.CELULAR) : cell(row, col.MOVIL);
      const norm = this.normalizeCelular(cel);
      if (norm) sheetPhones.add(norm);
    }

    const existingProspectos = new Map<string, { id: string; estado: string }>();
    if (sheetPhones.size > 0) {
      const existingRows = await this.prisma.flotaProspecto.findMany({
        where: { celular: { not: null } },
        select: { id: true, celular: true, estado: true },
      });
      for (const r of existingRows) {
        const norm = this.normalizeCelular(r.celular);
        if (norm && sheetPhones.has(norm)) {
          existingProspectos.set(norm, { id: r.id, estado: r.estado });
        }
      }
    }

    const batchPhones = new Map<string, number>();
    const records: any[] = [];
    const updateBatch: Array<{ id: string; data: Record<string, unknown> }> = [];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const nombre = col.NOMBRE_COMPLETO !== -1 ? cell(row, col.NOMBRE_COMPLETO) : '';
      const celular = col.CELULAR !== -1 ? cell(row, col.CELULAR) : cell(row, col.MOVIL);
      const celularNorm = this.normalizeCelular(celular) || '';
      if (nombre && sampleNames.length < 5) sampleNames.push(nombre);

      if (!celularNorm && !nombre) {
        skipped++;
        errors.push({ row: i + 1, message: 'Omitida por falta de nombre y celular.' });
        continue;
      }

      let esDuplicado = false;
      if (celularNorm) {
        if (existingProspectos.has(celularNorm) || batchPhones.has(celularNorm)) {
          esDuplicado = true;
        }
        if (!esDuplicado) {
          batchPhones.set(celularNorm, records.length);
        }
      }

      if (esDuplicado) {
        const existing = existingProspectos.get(celularNorm);
        if (existing && celularNorm) {
          const updateData: Record<string, unknown> = {};
          if (nombre) updateData.nombreCompleto = nombre;
          if (col.RED_SOCIAL !== -1) { const val = cell(row, col.RED_SOCIAL); if (val) updateData.redSocial = val; }
          if (col.EDAD !== -1) { const val = parseInt10(cell(row, col.EDAD)); if (val !== null) updateData.edad = val; }
          if (col.OPERADOR !== -1) { const val = cell(row, col.OPERADOR); if (val) { updateData.operador = val; updateData.asignadoAt = limaDate(); } }
          if (col.ESTADO !== -1) { const val = cell(row, col.ESTADO); if (val) updateData.estado = normalizeEstado(val); }
          if (col.MODALIDAD !== -1) { const val = cell(row, col.MODALIDAD); if (val) updateData.modalidad = val; }
          if (col.ANIO_VEHICULO !== -1) { const val = parseInt10(cell(row, col.ANIO_VEHICULO)); if (val !== null) updateData.anioVehiculo = val; }
          if (col.PLACA !== -1) { const val = cell(row, col.PLACA); if (val) updateData.placa = val; }
          if (col.DISTRITO !== -1) { const val = cell(row, col.DISTRITO); if (val) updateData.distrito = val; }
          if (col.FECHA_CITA !== -1) { const val = parseDate(cell(row, col.FECHA_CITA)); if (val) updateData.fechaCita = val; }
          if (col.ASISTENCIA !== -1) { const val = cell(row, col.ASISTENCIA); if (val) updateData.asistencia = val; }
          if (col.FECHA_AFILIACION !== -1) { const val = parseDate(cell(row, col.FECHA_AFILIACION)); if (val) updateData.fechaAfiliacion = val; }
          if (col.MOVIL !== -1) { const val = cell(row, col.MOVIL); if (val) updateData.movil = val; }
          if (col.OBSERVACIONES !== -1) { const val = cell(row, col.OBSERVACIONES); if (val) updateData.observaciones = val; }
          if (col.FECHA_REGISTRO !== -1) { const val = parseDate(cell(row, col.FECHA_REGISTRO)); if (val) updateData.fechaRegistro = val; }
          if (Object.keys(updateData).length > 0) {
            updateBatch.push({ id: existing.id, data: updateData });
            if (updateBatch.length >= 100) {
              const batch = [...updateBatch];
              updateBatch.length = 0;
              await this.prisma.$transaction(async (tx) => {
                await Promise.all(
                  batch.map(({ id, data }) => tx.flotaProspecto.update({ where: { id }, data: data as any })),
                );
              }, { timeout: 30000 });
              updated += batch.length;
              update({ processedRows: i + 1, created, updated, skipped, errorCount: errors.length });
            }
          } else {
            skipped++;
          }
        } else {
          skipped++;
          errors.push({ row: i + 1, message: `Omitida por duplicado (Celular: ${celularNorm || celular}).` });
        }
        continue;
      }

      const estadoRaw = col.ESTADO !== -1 ? cell(row, col.ESTADO) : '';
      const estado = normalizeEstado(estadoRaw);

      records.push({
        fechaRegistro: col.FECHA_REGISTRO !== -1 ? parseDate(cell(row, col.FECHA_REGISTRO)) : null,
        redSocial: col.RED_SOCIAL !== -1 ? cell(row, col.RED_SOCIAL) || null : null,
        celular: celularNorm ? `+51${celularNorm}` : null,
        nombreCompleto: nombre,
        edad: col.EDAD !== -1 ? parseInt10(cell(row, col.EDAD)) : null,
        operador: col.OPERADOR !== -1 ? cell(row, col.OPERADOR) || null : null,
        estado,
        asignadoAt: col.OPERADOR !== -1 && cell(row, col.OPERADOR) ? limaDate() : null,
        modalidad: col.MODALIDAD !== -1 ? cell(row, col.MODALIDAD) || null : null,
        anioVehiculo: col.ANIO_VEHICULO !== -1 ? parseInt10(cell(row, col.ANIO_VEHICULO)) : null,
        placa: col.PLACA !== -1 ? cell(row, col.PLACA) || null : null,
        distrito: col.DISTRITO !== -1 ? cell(row, col.DISTRITO) || null : null,
        fechaCita: col.FECHA_CITA !== -1 ? parseDate(cell(row, col.FECHA_CITA)) : null,
        asistencia: col.ASISTENCIA !== -1 ? cell(row, col.ASISTENCIA) || null : null,
        fechaAfiliacion: col.FECHA_AFILIACION !== -1 ? parseDate(cell(row, col.FECHA_AFILIACION)) : null,
        movil: col.MOVIL !== -1 ? cell(row, col.MOVIL) || null : null,
        observaciones: col.OBSERVACIONES !== -1 ? cell(row, col.OBSERVACIONES) || null : null,
        esDuplicado,
        origen: "IMPORTADO",
      });

      // Report progress every 100 rows
      if ((i + 1) % 100 === 0) {
        update({ processedRows: i + 1, created, updated, skipped, errorCount: errors.length });
      }
    }

    update({ processedRows: dataRows.length, created, updated, skipped, errorCount: errors.length });

    // Flush remaining updates
    if (updateBatch.length > 0) {
      const batch = [...updateBatch];
      updateBatch.length = 0;
      await this.prisma.$transaction(async (tx) => {
        await Promise.all(
          batch.map(({ id, data }) => tx.flotaProspecto.update({ where: { id }, data: data as any })),
        );
      }, { timeout: 30000 });
      updated += batch.length;
    }

    // Insert new records in batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      try {
        await this.prisma.flotaProspecto.createMany({ data: batch as any });
        created += batch.length;
      } catch (err) {
        const msg = `Error insertando lote ${Math.floor(i / BATCH_SIZE) + 1}: ${err instanceof Error ? err.message : String(err)}`;
        this.logger.error(msg);
        errors.push({ row: i + 1, message: msg });
      }
      update({ processedRows: dataRows.length, created, updated, skipped, errorCount: errors.length });
    }

    this.logger.log(`Importación completada: ${created} creados, ${updated} actualizados, ${skipped} omitidos, ${errors.length} errores`);

    const sampleText = sampleNames.length > 0 ? ` Ej: ${sampleNames.join(', ')}` : '';
    await this.activityLogs.record(actor || null, {
      action: 'importar',
      module: 'flota',
      entityType: 'flota-prospecto',
      description: `Importación desde Google Sheets (${sheetName}): ${created} creados, ${updated} actualizados, ${skipped} omitidos, ${errors.length} errores.${sampleText}`,
    });

    return { totalRows, created, skipped, errors };
  }

  /** Contar prospectos por estado y duplicados */
  async getCounts(scope?: CrmDataScope) {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const baseWhere = { eliminadoAt: null } as Record<string, unknown>;
    if (scope && !scope.unrestricted) {
      const operadorFilter = await this.getScopeOperadorFilter(scope.viewerUserId);
      if (operadorFilter) {
        baseWhere.OR = [operadorFilter, { operador: null }] as any;
      }
    }

    const [total, duplicados, estados, redes, operadores, modalidades, nuevosEsteMes, nuevosMesPasado] = await Promise.all([
      this.prisma.flotaProspecto.count({ where: baseWhere as any }),
      this.prisma.flotaProspecto.count({ where: { esDuplicado: true, ...baseWhere } as any }),
      this.prisma.$queryRawUnsafe<Array<{ estado: string; count: bigint }>>(
        `SELECT estado, COUNT(*)::int as count FROM "FlotaProspecto" WHERE "eliminadoAt" IS NULL GROUP BY estado`,
      ),
      this.prisma.flotaProspecto.findMany({
        where: { redSocial: { not: null }, eliminadoAt: null },
        select: { redSocial: true },
        distinct: ['redSocial'],
      }),
      this.prisma.flotaProspecto.findMany({
        where: { operador: { not: null }, eliminadoAt: null },
        select: { operador: true },
        distinct: ['operador'],
      }),
      this.prisma.flotaProspecto.findMany({
        where: { modalidad: { not: null }, eliminadoAt: null },
        select: { modalidad: true },
        distinct: ['modalidad'],
      }),
      this.prisma.flotaProspecto.count({
        where: {
          createdAt: {
            gte: startOfCurrentMonth,
          },
          ...baseWhere,
        } as any,
      }),
      this.prisma.flotaProspecto.count({
        where: {
          createdAt: {
            gte: startOfPrevMonth,
            lte: endOfPrevMonth,
          },
          ...baseWhere,
        } as any,
      }),
    ]);

    const estadoCounts: Record<string, number> = {};
    for (const row of estados) {
      estadoCounts[row.estado] = Number(row.count);
    }

    const redesSociales = redes.map((r) => r.redSocial).filter(Boolean).sort();
    const operadoresList = operadores.map((r) => r.operador).filter(Boolean).sort();
    const modalidadList = modalidades.map((r) => r.modalidad).filter(Boolean).sort();

    return {
      total,
      duplicados,
      estadoCounts,
      redesSociales,
      operadores: operadoresList,
      modalidades: modalidadList,
      nuevosEsteMes,
      nuevosMesPasado,
    };
  }

  /** Fecha calendario Lima (YYYY-MM-DD). */
  private limaDateString(d: Date = new Date()): string {
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  }

  private eachDateInclusive(fecini: string, fecfin: string): string[] {
    const out: string[] = [];
    const cur = new Date(fecini + 'T12:00:00.000-05:00');
    const end = new Date(fecfin + 'T12:00:00.000-05:00');
    while (cur <= end) {
      out.push(cur.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  private emptyOperadorStats(operador: string) {
    return {
      operador,
      prospectosAsignados: 0,
      chatsActivos: 0,
      mensajesEnviados: 0,
      mensajesRecibidos: 0,
      llamadas: 0,
      citasProgramadas: 0,
    };
  }

  private mergeOperadorStats(
    target: Map<string, ReturnType<FlotaProspectosService['emptyOperadorStats']>>,
    rows: ReturnType<FlotaProspectosService['emptyOperadorStats']>[],
  ) {
    for (const row of rows) {
      const existing = target.get(row.operador);
      if (!existing) {
        target.set(row.operador, { ...row });
        continue;
      }
      existing.prospectosAsignados += row.prospectosAsignados;
      existing.chatsActivos += row.chatsActivos;
      existing.mensajesEnviados += row.mensajesEnviados;
      existing.mensajesRecibidos += row.mensajesRecibidos;
      existing.llamadas += row.llamadas;
      existing.citasProgramadas += row.citasProgramadas;
    }
  }

  private dateOnlyUtc(yyyyMmDd: string): Date {
    return new Date(yyyyMmDd + 'T00:00:00.000Z');
  }

  private fechaToYmd(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }

  /** Agrupa días faltantes en rangos contiguos para un solo computeLive por tramo. */
  private missingDayRanges(missingDays: string[]): { start: string; end: string }[] {
    if (missingDays.length === 0) return [];
    const sorted = [...missingDays].sort();
    const ranges: { start: string; end: string }[] = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const d = sorted[i];
      const nextDay = new Date(prev + 'T12:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const expected = nextDay.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      if (d !== expected) {
        ranges.push({ start, end: prev });
        start = d;
      }
      prev = d;
    }
    ranges.push({ start, end: prev });
    return ranges;
  }

  /**
   * Lee historial diario si existe; huecos sin snapshot se calculan en vivo
   * por rangos contiguos (no día a día). No incluye días futuros.
   */
  async getOperadorStats(fecini: string, fecfin: string, scope?: CrmDataScope) {
    const today = this.limaDateString();
    const effectiveEnd = fecfin > today ? today : fecfin;
    if (fecini > effectiveEnd) return [];

    const days = this.eachDateInclusive(fecini, effectiveEnd);
    if (days.length === 0) return [];

    const rangeStart = this.dateOnlyUtc(fecini);
    const rangeEndExclusive = this.dateOnlyUtc(effectiveEnd);
    rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);

    const historyRows = await this.prisma.flotaOperadorStatsDaily.findMany({
      where: {
        fecha: { gte: rangeStart, lt: rangeEndExclusive },
      },
    });

    const coveredFromDb = new Set(historyRows.map((r) => this.fechaToYmd(r.fecha)));

    // Sin historial en el rango: un solo cálculo en vivo
    if (coveredFromDb.size === 0) {
      return this.applyOperadorStatsScope(
        await this.computeLiveOperadorStats(fecini, effectiveEnd, scope),
        scope,
      );
    }

    const aggregated = new Map<string, ReturnType<FlotaProspectosService['emptyOperadorStats']>>();
    this.mergeOperadorStats(
      aggregated,
      historyRows.map((r) => ({
        operador: r.operador,
        prospectosAsignados: r.prospectosAsignados,
        chatsActivos: r.chatsActivos,
        mensajesEnviados: r.mensajesEnviados,
        mensajesRecibidos: r.mensajesRecibidos,
        llamadas: r.llamadas,
        citasProgramadas: r.citasProgramadas,
      })),
    );

    const missingDays = days.filter((day) => !coveredFromDb.has(day));
    for (const range of this.missingDayRanges(missingDays)) {
      const live = await this.computeLiveOperadorStats(range.start, range.end, scope);
      this.mergeOperadorStats(aggregated, live);
    }

    return this.applyOperadorStatsScope(Array.from(aggregated.values()), scope);
  }

  private async applyOperadorStatsScope(
    rows: ReturnType<FlotaProspectosService['emptyOperadorStats']>[],
    scope?: CrmDataScope,
  ) {
    if (!scope || scope.unrestricted) return rows;

    const filter = await this.getScopeOperadorFilter(scope.viewerUserId);
    if (!filter) return [];
    const op = (filter as { operador?: string | { in?: string[] } }).operador;
    const aliases = typeof op === 'string' ? [op] : (op?.in ?? []);
    const allowed = new Set(aliases.map((a) => a.trim().toLowerCase()));
    if (allowed.size === 0) return [];
    return rows.filter((r) => {
      const name = r.operador.trim().toLowerCase();
      return allowed.has(name) || [...allowed].some((a) => name.includes(a) || a.includes(name));
    });
  }

  /** Persiste el snapshot de un día calendario (Lima). Idempotente (upsert). */
  async snapshotOperadorStatsDay(fecha: string) {
    const rows = await this.computeLiveOperadorStats(fecha, fecha);
    const fechaDate = this.dateOnlyUtc(fecha);

    for (const row of rows) {
      await this.prisma.flotaOperadorStatsDaily.upsert({
        where: {
          fecha_operador: { fecha: fechaDate, operador: row.operador },
        },
        create: {
          fecha: fechaDate,
          operador: row.operador,
          prospectosAsignados: row.prospectosAsignados,
          chatsActivos: row.chatsActivos,
          mensajesEnviados: row.mensajesEnviados,
          mensajesRecibidos: row.mensajesRecibidos,
          llamadas: row.llamadas,
          citasProgramadas: row.citasProgramadas,
        },
        update: {
          prospectosAsignados: row.prospectosAsignados,
          chatsActivos: row.chatsActivos,
          mensajesEnviados: row.mensajesEnviados,
          mensajesRecibidos: row.mensajesRecibidos,
          llamadas: row.llamadas,
          citasProgramadas: row.citasProgramadas,
        },
      });
    }

    return { fecha, operadores: rows.length };
  }

  /**
   * Backfill de un rango: cálculo en vivo por día + upsert.
   * `asignadosOverrides`: mapa "YYYY-MM-DD|Operador" → prospectosAsignados corregidos.
   * Si `replaceAsignados` es true, ignora el live para asignados y usa solo overrides
   * (días sin override → 0 para operadores presentes en el mapa).
   */
  async backfillOperadorStatsDaily(
    fecini: string,
    fecfin: string,
    asignadosOverrides?: Map<string, number>,
    replaceAsignados = false,
  ) {
    const days = this.eachDateInclusive(fecini, fecfin);
    let upserts = 0;

    const overrideOperators = new Set<string>();
    if (asignadosOverrides) {
      for (const key of asignadosOverrides.keys()) {
        const sep = key.indexOf('|');
        if (sep >= 0) overrideOperators.add(key.slice(sep + 1));
      }
    }

    for (const day of days) {
      const live = await this.computeLiveOperadorStats(day, day);
      const byOperador = new Map(live.map((r) => [r.operador, { ...r }]));

      if (replaceAsignados && asignadosOverrides) {
        for (const op of overrideOperators) {
          const existing = byOperador.get(op) || this.emptyOperadorStats(op);
          existing.prospectosAsignados = asignadosOverrides.get(`${day}|${op}`) || 0;
          byOperador.set(op, existing);
        }
      } else if (asignadosOverrides) {
        for (const [key, count] of asignadosOverrides.entries()) {
          const sep = key.indexOf('|');
          if (sep < 0) continue;
          const d = key.slice(0, sep);
          const op = key.slice(sep + 1);
          if (d !== day) continue;
          const existing = byOperador.get(op) || this.emptyOperadorStats(op);
          existing.prospectosAsignados = count;
          byOperador.set(op, existing);
        }
      }

      const fechaDate = this.dateOnlyUtc(day);
      for (const row of byOperador.values()) {
        // No guardar filas totalmente vacías
        if (
          row.prospectosAsignados === 0 &&
          row.chatsActivos === 0 &&
          row.mensajesEnviados === 0 &&
          row.mensajesRecibidos === 0 &&
          row.llamadas === 0 &&
          row.citasProgramadas === 0
        ) {
          continue;
        }

        await this.prisma.flotaOperadorStatsDaily.upsert({
          where: {
            fecha_operador: { fecha: fechaDate, operador: row.operador },
          },
          create: {
            fecha: fechaDate,
            operador: row.operador,
            prospectosAsignados: row.prospectosAsignados,
            chatsActivos: row.chatsActivos,
            mensajesEnviados: row.mensajesEnviados,
            mensajesRecibidos: row.mensajesRecibidos,
            llamadas: row.llamadas,
            citasProgramadas: row.citasProgramadas,
          },
          update: {
            prospectosAsignados: row.prospectosAsignados,
            chatsActivos: row.chatsActivos,
            mensajesEnviados: row.mensajesEnviados,
            mensajesRecibidos: row.mensajesRecibidos,
            llamadas: row.llamadas,
            citasProgramadas: row.citasProgramadas,
          },
        });
        upserts += 1;
      }
    }

    return { from: fecini, to: fecfin, days: days.length, upserts };
  }

  /**
   * Reconstruye asignados desde ActivityLog (primera asignación por prospecto+operador en el rango)
   * y hace backfill del historial diario. Usado para corregir semanas alteradas por reasignaciones.
   */
  async backfillOperadorStatsFromActivityLog(fecini: string, fecfin: string) {
    const start = new Date(fecini + 'T00:00:00.000-05:00');
    const end = new Date(fecfin + 'T00:00:00.000-05:00');
    end.setDate(end.getDate() + 1);

    const logs = await this.prisma.activityLog.findMany({
      where: {
        module: 'flota',
        action: 'asignar',
        createdAt: { gte: start, lt: end },
        description: { contains: 'Operador asignado:' },
        entityId: { not: null },
      },
      select: { entityId: true, description: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const allOperadorUsers = await this.prisma.user.findMany({
      where: { role: { slug: 'operador' } },
      select: {
        name: true,
        accounts: {
          where: { provider: 'credentials' },
          select: { providerId: true },
        },
      },
    });

    const nameResolutionMap = new Map<string, string>();
    for (const user of allOperadorUsers) {
      const canonicalName = user.name;
      const username = user.accounts[0]?.providerId || null;
      const firstName = canonicalName.split(' ')[0] || '';
      nameResolutionMap.set(canonicalName, canonicalName);
      nameResolutionMap.set(canonicalName.toLowerCase(), canonicalName);
      nameResolutionMap.set(normalizeStr(canonicalName), canonicalName);
      if (username) {
        nameResolutionMap.set(username, canonicalName);
        nameResolutionMap.set(username.toLowerCase(), canonicalName);
      }
      if (firstName) {
        nameResolutionMap.set(firstName, canonicalName);
        nameResolutionMap.set(firstName.toLowerCase(), canonicalName);
      }
    }

    const resolve = (raw: string) =>
      nameResolutionMap.get(raw) ||
      nameResolutionMap.get(raw.toLowerCase()) ||
      nameResolutionMap.get(normalizeStr(raw)) ||
      raw;

    const seen = new Set<string>();
    const overrides = new Map<string, number>();

    for (const log of logs) {
      if (!log.entityId) continue;
      const match = log.description.match(/Operador asignado:\s*(.+)$/i);
      if (!match) continue;
      const operador = resolve(match[1].trim());
      if (!operador) continue;
      const dedupeKey = `${log.entityId}|${operador}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const day = log.createdAt.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      const mapKey = `${day}|${operador}`;
      overrides.set(mapKey, (overrides.get(mapKey) || 0) + 1);
    }

    this.logger.log(
      `ActivityLog asignados overrides: ${overrides.size} celdas, ${seen.size} prospectos únicos`,
    );
    for (const [k, v] of overrides) {
      this.logger.log(`  override ${k} = ${v}`);
    }

    return this.backfillOperadorStatsDaily(fecini, fecfin, overrides, true);
  }

  /** Cálculo en vivo (misma lógica original) — no usa historial. */
  async computeLiveOperadorStats(fecini: string, fecfin: string, scope?: CrmDataScope) {
    // DateTime (mensajes, llamadas): ventana en hora Lima
    const startDate = new Date(fecini + 'T00:00:00.000-05:00');
    const endDate = new Date(fecfin + 'T00:00:00.000-05:00');
    endDate.setDate(endDate.getDate() + 1);

    // Campos @db.Date (asignadoAt): comparar contra medianoche UTC del día calendario
    const startDateOnly = this.dateOnlyUtc(fecini);
    const endDateOnly = this.dateOnlyUtc(fecfin);
    endDateOnly.setUTCDate(endDateOnly.getUTCDate() + 1);

    const baseWhere: any = { eliminadoAt: null };

    if (scope && !scope.unrestricted) {
      const operadorFilter = await this.getScopeOperadorFilter(scope.viewerUserId);
      if (operadorFilter) {
        baseWhere.OR = [operadorFilter];
      }
    }

    // 1. Cargar todos los usuarios con role 'operador' para construir el mapa de resolución de nombres
    const allOperadorUsers = await this.prisma.user.findMany({
      where: { role: { slug: 'operador' } },
      select: {
        id: true,
        name: true,
        accounts: {
          where: { provider: 'credentials' },
          select: { providerId: true },
        },
      },
    });

    // 2. Construir mapa de resolución: rawName → { canonicalName, userId }
    const nameResolutionMap = new Map<string, { canonicalName: string; userId: string }>();

    for (const user of allOperadorUsers) {
      const canonicalName = user.name;
      const userId = user.id;
      const username = user.accounts[0]?.providerId || null;
      const firstName = canonicalName.split(' ')[0] || '';
      const normalizedFull = normalizeStr(canonicalName);

      // Mapear canonical name → self
      nameResolutionMap.set(canonicalName, { canonicalName, userId });
      nameResolutionMap.set(canonicalName.toLowerCase(), { canonicalName, userId });
      nameResolutionMap.set(normalizedFull, { canonicalName, userId });

      // Mapear username → canonical
      if (username && username !== canonicalName) {
        nameResolutionMap.set(username, { canonicalName, userId });
        nameResolutionMap.set(username.toLowerCase(), { canonicalName, userId });
      }

      // Mapear primer nombre → canonical
      if (firstName && firstName.toLowerCase() !== canonicalName.toLowerCase()) {
        nameResolutionMap.set(firstName, { canonicalName, userId });
        nameResolutionMap.set(firstName.toLowerCase(), { canonicalName, userId });
      }
    }

    function resolveName(raw: string): { canonicalName: string; userId: string } | null {
      const trimmed = raw.trim();
      if (!trimmed) return null;

      // Búsqueda exacta
      const exact = nameResolutionMap.get(trimmed);
      if (exact) return exact;

      // Búsqueda case-insensitive
      const ci = nameResolutionMap.get(trimmed.toLowerCase());
      if (ci) return ci;

      // Búsqueda normalizada
      const norm = nameResolutionMap.get(normalizeStr(trimmed));
      if (norm) return norm;

      return null;
    }

    // 3. Recolectar nombres raw de prospectos
    const prospectOperators = await this.prisma.flotaProspecto.findMany({
      where: { ...baseWhere, operador: { not: null } },
      select: { operador: true },
      distinct: ['operador'],
    });

    // 4. Recolectar nombres de senders (outbound messages)
    const senderWhere: any = {
      direction: 'outbound',
      createdAt: { gte: startDate, lt: endDate },
    };
    if (scope && !scope.unrestricted) {
      const user = await this.prisma.user.findUnique({
        where: { id: scope.viewerUserId },
        select: { name: true },
      });
      if (user?.name) {
        senderWhere.createdBy = { name: user.name };
      } else {
        senderWhere.createdByUserId = { not: null };
      }
    } else {
      senderWhere.createdByUserId = { not: null };
    }
    const senders = await this.prisma.crmWhatsappMessage.findMany({
      where: { ...senderWhere, createdBy: { ...senderWhere.createdBy, role: { slug: 'operador' } } },
      select: { createdBy: { select: { name: true } } },
      distinct: ['createdByUserId'],
    });

    // 5. Agrupar por canonicalName: { userIds, operadorVariants }
    const canonicalGroups = new Map<string, { userIds: string[]; operadorVariants: string[] }>();

    for (const o of prospectOperators) {
      if (!o.operador) continue;
      const resolved = resolveName(o.operador);
      const canonical = resolved?.canonicalName || o.operador;
      const variant = o.operador;

      let group = canonicalGroups.get(canonical);
      if (!group) {
        group = { userIds: resolved?.userId ? [resolved.userId] : [], operadorVariants: [] };
        canonicalGroups.set(canonical, group);
      }
      if (resolved?.userId && !group.userIds.includes(resolved.userId)) {
        group.userIds.push(resolved.userId);
      }
      if (!group.operadorVariants.includes(variant)) {
        group.operadorVariants.push(variant);
      }
    }

    for (const s of senders) {
      if (!s.createdBy?.name) continue;
      const resolved = resolveName(s.createdBy.name);
      const canonical = resolved?.canonicalName || s.createdBy.name;
      const variant = s.createdBy.name;

      let group = canonicalGroups.get(canonical);
      if (!group) {
        group = { userIds: resolved?.userId ? [resolved.userId] : [], operadorVariants: [] };
        canonicalGroups.set(canonical, group);
      }
      if (resolved?.userId && !group.userIds.includes(resolved.userId)) {
        group.userIds.push(resolved.userId);
      }
      if (!group.operadorVariants.includes(variant)) {
        group.operadorVariants.push(variant);
      }
    }

    // 6. Ejecutar métricas agrupadas por canonicalName
    const rows = await Promise.all(
      Array.from(canonicalGroups.entries()).map(async ([canonicalName, group]) => {
        const { userIds, operadorVariants } = group;

        const [prospectosAsignados, mensajesEnviados, mensajesRecibidos, chatsData, llamadas, citasProgramadas] = await Promise.all([
          this.prisma.flotaProspecto.count({
            where: operadorVariants.length > 0
              ? { operador: { in: operadorVariants }, asignadoAt: { gte: startDateOnly, lt: endDateOnly } }
              : { operador: canonicalName, asignadoAt: { gte: startDateOnly, lt: endDateOnly } },
          }),
          this.prisma.crmWhatsappMessage.count({
            where: {
              direction: 'outbound',
              createdAt: { gte: startDate, lt: endDate },
              createdByUserId: userIds.length > 0
                ? { in: userIds }
                : { equals: '__no_user__' },
            },
          }),
          this.prisma.crmWhatsappMessage.count({
            where: {
              direction: 'inbound',
              createdAt: { gte: startDate, lt: endDate },
              ...(operadorVariants.length > 0
                ? { flotaProspecto: { operador: { in: operadorVariants } } }
                : { flotaProspecto: { operador: canonicalName } }),
            },
          }),
          this.prisma.crmWhatsappMessage.findMany({
            where: {
              createdAt: { gte: startDate, lt: endDate },
              OR: [
                ...(userIds.length > 0
                  ? [{ createdByUserId: { in: userIds } }]
                  : [] as any[]),
                ...(operadorVariants.length > 0
                  ? [
                      { direction: 'inbound', flotaProspecto: { operador: { in: operadorVariants } } },
                      { direction: 'outbound', flotaProspecto: { operador: { in: operadorVariants } } },
                    ]
                  : [] as any[]),
              ],
            },
            select: { flotaProspectoId: true },
            distinct: ['flotaProspectoId'],
            orderBy: { flotaProspectoId: 'asc' },
          }),
          this.prisma.flotaLlamada.count({
            where: {
              createdAt: { gte: startDate, lt: endDate },
              ...(operadorVariants.length > 0
                ? { prospecto: { operador: { in: operadorVariants } } }
                : { prospecto: { operador: canonicalName } }),
            },
          }),
          this.prisma.flotaProspecto.count({
            where: {
              fechaCita: { gte: startDate, lt: endDate },
              ...(operadorVariants.length > 0
                ? { operador: { in: operadorVariants } }
                : { operador: canonicalName }),
            },
          }),
        ]);

        return {
          operador: canonicalName,
          prospectosAsignados,
          chatsActivos: chatsData.length,
          mensajesEnviados,
          mensajesRecibidos,
          llamadas,
          citasProgramadas,
        };
      }),
    );

    return rows;
  }

  async getLlamadas(prospectoId: string) {
    return this.prisma.flotaLlamada.findMany({
      where: { prospectoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCalendarCitas() {
    const rows = await this.prisma.flotaProspecto.findMany({
      where: { fechaCita: { not: null } },
      select: {
        id: true,
        nombreCompleto: true,
        celular: true,
        fechaCita: true,
        distrito: true,
        redSocial: true,
        modalidad: true,
        anioVehiculo: true,
        operador: true,
        asistencia: true,
      },
      orderBy: { fechaCita: 'asc' },
    });
    return rows;
  }

  async createLlamada(prospectoId: string, data: { userName: string; notas?: string | null; createdAt?: string | null }) {
    return this.prisma.flotaLlamada.create({
      data: {
        prospectoId,
        userName: data.userName,
        notas: data.notas ?? null,
        createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      },
    });
  }
}
