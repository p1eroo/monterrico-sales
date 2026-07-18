import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ExternalClienteEmpresaResponse,
  ExternalClienteEmpresaRow,
} from './cliente-cartera-external.types';

const EXTERNAL_CLIENTES_URL =
  'https://api.taximonterrico.com/api/WClientes/Registrados';

const UPSERT_BATCH_SIZE = 50;

const MONTHS_ORDER: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

@Injectable()
export class ClienteCarteraSyncService {
  private readonly logger = new Logger(ClienteCarteraSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Igual que el listado original del frontend: 1 llamada WClientes por agente,
   * guardar en BD y devolver el conteo.
   */
  async syncForAgentes(agentes: string[]): Promise<{ empresas: number }> {
    const unique = [
      ...new Set(
        agentes.map((a) => a.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    if (unique.length === 0) {
      return { empresas: 0 };
    }

    let total = 0;
    for (const agente of unique) {
      const rows = await this.fetchExternalEmpresas(agente);
      for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
        await Promise.all(
          batch.map((ext) => this.upsertEmpresa(ext, agente)),
        );
      }
      total += rows.length;
    }

    return { empresas: total };
  }

  /** Sync del usuario logueado (mismo agente que Clients.tsx original). */
  async syncForCurrentUser(username: string): Promise<{ empresas: number }> {
    const agente = username.trim().toLowerCase();
    if (!agente) return { empresas: 0 };
    return this.syncForAgentes([agente]);
  }

  async resolveAgentesForSync(
    username: string,
    unrestricted: boolean,
  ): Promise<string[]> {
    if (!unrestricted) {
      return username.trim() ? [username.trim().toLowerCase()] : [];
    }
    const users = await this.prisma.user.findMany({
      where: { status: 'activo' },
      select: {
        accounts: {
          where: { provider: 'credentials' },
          select: { providerId: true },
        },
      },
    });
    const agentes = users
      .map((u) => u.accounts[0]?.providerId?.trim().toLowerCase())
      .filter((a): a is string => !!a);
    return [...new Set(agentes)];
  }

  private async fetchExternalEmpresas(
    agente: string,
  ): Promise<ExternalClienteEmpresaRow[]> {
    try {
      const url = `${EXTERNAL_CLIENTES_URL}?agente=${encodeURIComponent(agente)}&condicion=1&limit=5000`;
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(
          `API externa empresas falló para ${agente}: ${response.statusText}`,
        );
        return [];
      }
      const data = (await response.json()) as ExternalClienteEmpresaResponse;
      return data.ARegistrados ?? [];
    } catch (e) {
      this.logger.error(`Error sync empresas (${agente}): ${e}`);
      return [];
    }
  }

  private computeYearTotal(ext: ExternalClienteEmpresaRow): number {
    const currentMonthIdx = new Date().getMonth();
    let total = 0;
    for (let i = 1; i <= 5; i++) {
      const mName = ext[`mes${i}` as keyof ExternalClienteEmpresaRow] as
        | string
        | undefined;
      const mAmount = ext[`monto${i}` as keyof ExternalClienteEmpresaRow] as
        | number
        | undefined;
      if (!mName) continue;
      const idx = MONTHS_ORDER[mName.toLowerCase().trim()];
      if (idx !== undefined && idx <= currentMonthIdx) {
        total += mAmount ?? 0;
      }
    }
    return total;
  }

  private parseFechaAlta(raw: string): Date {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private empresaPayload(
    ext: ExternalClienteEmpresaRow,
    agenteSync: string,
  ): Omit<Prisma.ClienteEmpresaCreateInput, 'externalId'> {
    const ingresosAnual = this.computeYearTotal(ext);
    return {
      empresa: ext.nombrecomercial || ext.razonsocial,
      ruc: ext.rucempresa?.trim() || null,
      telefono: ext.telefono?.trim() || null,
      email: ext.contactoemail?.trim() || null,
      asesor: (ext.asesorresponsable || '').trim().toLowerCase(),
      agenteSync,
      fechaAlta: this.parseFechaAlta(ext.fechor),
      ingresos: ext.monto1 ?? 0,
      ingresosAnual,
      mesActual: ext.mes1 ?? null,
      logoUrl: ext.logoempresa?.trim() || null,
      status: 'activo',
      contactoNombre: ext.contacto?.trim() || null,
      servicio: ext.tipopagodetalle?.trim() || null,
      mes1: ext.mes1 ?? null,
      monto1: ext.monto1 ?? null,
      mes2: ext.mes2 ?? null,
      monto2: ext.monto2 ?? null,
      mes3: ext.mes3 ?? null,
      monto3: ext.monto3 ?? null,
      mes4: ext.mes4 ?? null,
      monto4: ext.monto4 ?? null,
      mes5: ext.mes5 ?? null,
      monto5: ext.monto5 ?? null,
    };
  }

  private async upsertEmpresa(
    ext: ExternalClienteEmpresaRow,
    agenteSync: string,
  ) {
    const data = this.empresaPayload(ext, agenteSync);
    return this.prisma.clienteEmpresa.upsert({
      where: { externalId: ext.idclienteempresa },
      create: { externalId: ext.idclienteempresa, ...data },
      update: data,
    });
  }
}
