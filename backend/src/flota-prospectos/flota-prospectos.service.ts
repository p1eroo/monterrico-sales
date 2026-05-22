import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleSheetsService } from './google-sheets.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { ActivityActor } from '../activity-logs/activity-logs.types';

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
  DISTRITO: 10,
  FECHA_CITA: 11,
  ASISTENCIA: 12,
  FECHA_AFILIACION: 13,
  MOVIL: 14,
  OBSERVACIONES: 16,
};

function cell(row: string[], idx: number): string {
  return (row[idx] ?? '').toString().trim();
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  // Intentar dd/mm/yyyy o dd-mm-yyyy
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
  ) {}

  private normalizeCelular(celular?: string | null): string | null {
    if (!celular) return null;
    const digits = celular.replace(/\D/g, '');
    return digits.slice(-9) || null;
  }


  /** Lista ligera para el envío masivo desde CRM */
  async listForMasivo(search?: string) {
    const where: Record<string, unknown> = {};
    if (search?.trim()) {
      const s = search.trim();
      where.OR = [
        { nombreCompleto: { contains: s, mode: 'insensitive' } },
        { celular: { contains: s, mode: 'insensitive' } },
      ];
    }
    return this.prisma.flotaProspecto.findMany({
      where: where as any,
      select: { id: true, nombreCompleto: true, celular: true, movil: true },
      orderBy: { nombreCompleto: 'asc' },
      take: 5000,
    });
  }


  /** Lista paginada con filtros */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    estado?: string;
    duplicados?: boolean;
    mes?: string;
    redSocial?: string;
    operador?: string;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (params.estado) {
      where.estado = params.estado;
    }

    if (params.duplicados) {
      where.esDuplicado = true;
    }

    if (params.redSocial) {
      where.redSocial = params.redSocial;
    }

    if (params.operador) {
      where.operador = params.operador;
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

    if (params.search) {
      const s = params.search;
      where.OR = [
        { nombreCompleto: { contains: s, mode: 'insensitive' } },
        { celular: { contains: s, mode: 'insensitive' } },
        { distrito: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.flotaProspecto.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.flotaProspecto.count({ where: where as any }),
    ]);

    return { data, total, page, limit };
  }

  /** Obtener un prospecto por ID */
  async findOne(id: string) {
    return this.prisma.flotaProspecto.findUnique({ where: { id } });
  }

  /** Actualizar un prospecto */
  async update(id: string, data: Record<string, unknown>, actor?: ActivityActor) {
    const existing = await this.prisma.flotaProspecto.findUnique({ where: { id } });
    if (!existing) throw new Error('Prospecto no encontrado');

    const updated = await this.prisma.flotaProspecto.update({
      where: { id },
      data: data as any,
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
      await this.activityLogs.record(actor || null, {
        action: 'actualizar',
        module: 'flota',
        entityType: 'flota-prospecto',
        entityId: id,
        entityName: updated.nombreCompleto,
        description: `Actualización de observaciones: ${data.observaciones}`,
      });
    }

    return updated;
  }

  /** Crear un nuevo prospecto */
  async createOne(data: Record<string, unknown>) {
    return this.prisma.flotaProspecto.create({
      data: {
        ...data as any,
        fechaRegistro: data.fechaRegistro ? new Date(data.fechaRegistro as string) : null,
        fechaCita: data.fechaCita ? new Date(data.fechaCita as string) : null,
        fechaAfiliacion: data.fechaAfiliacion ? new Date(data.fechaAfiliacion as string) : null,
      },
    });
  }

  /** Eliminar un prospecto */
  async remove(id: string) {
    const existing = await this.prisma.flotaProspecto.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Prospecto no encontrado: ${id}`);
    }
    return this.prisma.flotaProspecto.delete({ where: { id } });
  }

  /** Eliminar múltiples prospectos */
  async removeMany(ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new Error('No se proporcionaron IDs');
    }
    const result = await this.prisma.flotaProspecto.deleteMany({
      where: { id: { in: ids } },
    });
    return result.count;
  }

  /** Obtener nombres de hojas del spreadsheet */
  async getSheetNames(): Promise<string[]> {
    return this.googleSheets.getSheetNames();
  }

  /** Obtiene las primeras 15 filas para vista previa */
  async getPreview(sheetName: string) {
    const rawRows = await this.googleSheets.readAllRows(sheetName);
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
          text.includes('NOMBRES') ||
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
        .toUpperCase(),
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
          h.includes('NOMBRES') ||
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
  async importFromSheets(sheetName?: string): Promise<ImportSheetsResult> {
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
      rawRows = await this.googleSheets.readAllRows(sheetName);
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
            if (val) updateData.operador = val;
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
              await this.prisma.$transaction(
                updateBatch.map(({ id, data }) =>
                  this.prisma.flotaProspecto.update({ where: { id }, data: data as any }),
                ),
              );
              result.updated += updateBatch.length;
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
        celular: celular || null,
        nombreCompleto: nombre,
        edad: col.EDAD !== -1 ? parseInt10(cell(row, col.EDAD)) : null,
        operador: col.OPERADOR !== -1 ? cell(row, col.OPERADOR) || null : null,
        estado,
        modalidad:
          col.MODALIDAD !== -1 ? cell(row, col.MODALIDAD) || null : null,
        anioVehiculo:
          col.ANIO_VEHICULO !== -1 ? parseInt10(cell(row, col.ANIO_VEHICULO)) : null,
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
      });
    }

    // Flush remaining updates
    if (updateBatch.length > 0) {
      await this.prisma.$transaction(
        updateBatch.map(({ id, data }) =>
          this.prisma.flotaProspecto.update({ where: { id }, data: data as any }),
        ),
      );
      result.updated += updateBatch.length;
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

  /** Contar prospectos por estado y duplicados */
  async getCounts() {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [total, duplicados, estados, redes, operadores, nuevosEsteMes, nuevosMesPasado] = await Promise.all([
      this.prisma.flotaProspecto.count(),
      this.prisma.flotaProspecto.count({ where: { esDuplicado: true } }),
      this.prisma.$queryRawUnsafe<Array<{ estado: string; count: bigint }>>(
        `SELECT estado, COUNT(*)::int as count FROM "FlotaProspecto" GROUP BY estado`,
      ),
      this.prisma.flotaProspecto.findMany({
        where: { redSocial: { not: null } },
        select: { redSocial: true },
        distinct: ['redSocial'],
      }),
      this.prisma.flotaProspecto.findMany({
        where: { operador: { not: null } },
        select: { operador: true },
        distinct: ['operador'],
      }),
      this.prisma.flotaProspecto.count({
        where: {
          createdAt: {
            gte: startOfCurrentMonth,
          },
        },
      }),
      this.prisma.flotaProspecto.count({
        where: {
          createdAt: {
            gte: startOfPrevMonth,
            lte: endOfPrevMonth,
          },
        },
      }),
    ]);

    const estadoCounts: Record<string, number> = {};
    for (const row of estados) {
      estadoCounts[row.estado] = Number(row.count);
    }

    const redesSociales = redes.map((r) => r.redSocial).filter(Boolean).sort();
    const operadoresList = operadores.map((r) => r.operador).filter(Boolean).sort();

    return {
      total,
      duplicados,
      estadoCounts,
      redesSociales,
      operadores: operadoresList,
      nuevosEsteMes,
      nuevosMesPasado,
    };
  }
}
