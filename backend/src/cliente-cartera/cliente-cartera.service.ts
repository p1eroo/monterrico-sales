import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';

type EmpresaRow = Prisma.ClienteEmpresaGetPayload<object>;

@Injectable()
export class ClienteCarteraService {
  constructor(private readonly prisma: PrismaService) {}

  async findEmpresas(scope: CrmDataScope, username: string) {
    const where = this.buildEmpresaAsesorWhere(scope, username);
    const rows = await this.prisma.clienteEmpresa.findMany({
      where,
      orderBy: { fechaAlta: 'desc' },
    });
    const advisorMap = await this.buildAdvisorMap(rows);
    return rows.map((row) => this.mapEmpresaToApi(row, advisorMap));
  }

  async findContactos(scope: CrmDataScope, username: string) {
    const where = this.buildContactoAsesorWhere(scope, username);
    const rows = await this.prisma.contactoEmpresa.findMany({
      where,
      orderBy: { nombres: 'asc' },
      include: {
        clienteEmpresa: {
          select: { empresa: true, logoUrl: true },
        },
      },
    });
    const advisorMap = await this.buildAdvisorMapFromUsernames(
      rows.map((r) => r.asesor).filter(Boolean) as string[],
    );
    return rows.map((row) => this.mapContactoToApi(row, advisorMap));
  }

  private buildEmpresaAsesorWhere(
    scope: CrmDataScope,
    username: string,
  ): Prisma.ClienteEmpresaWhereInput {
    if (scope.unrestricted) return {};
    const agente = username.trim().toLowerCase();
    if (!agente) return { id: '__none__' };
    return { agenteSync: agente };
  }

  private buildContactoAsesorWhere(
    scope: CrmDataScope,
    username: string,
  ): Prisma.ContactoEmpresaWhereInput {
    if (scope.unrestricted) return {};
    const asesor = username.trim().toLowerCase();
    if (!asesor) return { id: '__none__' };
    return { asesor };
  }

  private async buildAdvisorMap(rows: EmpresaRow[]) {
    return this.buildAdvisorMapFromUsernames(rows.map((r) => r.asesor));
  }

  private async buildAdvisorMapFromUsernames(usernames: string[]) {
    const unique = [...new Set(usernames.map((u) => u.trim().toLowerCase()).filter(Boolean))];
    if (unique.length === 0) return new Map<string, { id: string; name: string }>();

    const accounts = await this.prisma.account.findMany({
      where: {
        provider: 'credentials',
        providerId: { in: unique },
      },
      select: {
        providerId: true,
        user: { select: { id: true, name: true } },
      },
    });

    const map = new Map<string, { id: string; name: string }>();
    for (const acc of accounts) {
      map.set(acc.providerId.toLowerCase(), {
        id: acc.user.id,
        name: acc.user.name,
      });
    }
    return map;
  }

  private mapEmpresaToApi(
    row: EmpresaRow,
    advisorMap: Map<string, { id: string; name: string }>,
  ) {
    const advisor = advisorMap.get(row.asesor.toLowerCase());
    const advisorUserId = advisor?.id ?? row.asesor;
    return {
      id: row.id,
      externalId: row.externalId,
      empresa: row.empresa,
      ruc: row.ruc ?? undefined,
      telefono: row.telefono ?? undefined,
      email: row.email ?? undefined,
      asesor: row.asesor,
      agenteSync: row.agenteSync,
      assignedTo: advisorUserId,
      assignedToName: advisor?.name ?? (row.asesor || 'Sin asesor'),
      fechaAlta: row.fechaAlta.toISOString().slice(0, 10),
      ingresos: row.ingresos,
      ingresosAnual: row.ingresosAnual,
      mesActual: row.mesActual ?? undefined,
      logoUrl: row.logoUrl ?? undefined,
      status: row.status,
      contactoNombre: row.contactoNombre ?? undefined,
      servicio: row.servicio ?? undefined,
      mes1: row.mes1 ?? undefined,
      monto1: row.monto1 ?? undefined,
      mes2: row.mes2 ?? undefined,
      monto2: row.monto2 ?? undefined,
      mes3: row.mes3 ?? undefined,
      monto3: row.monto3 ?? undefined,
      mes4: row.mes4 ?? undefined,
      monto4: row.monto4 ?? undefined,
      mes5: row.mes5 ?? undefined,
      monto5: row.monto5 ?? undefined,
    };
  }

  private mapContactoToApi(
    row: Prisma.ContactoEmpresaGetPayload<{
      include: { clienteEmpresa: { select: { empresa: true; logoUrl: true } } };
    }>,
    advisorMap: Map<string, { id: string; name: string }>,
  ) {
    const asesorKey = row.asesor?.toLowerCase() ?? '';
    const advisor = asesorKey ? advisorMap.get(asesorKey) : undefined;
    const nombre = [row.nombres, row.apellidos].filter(Boolean).join(' ').trim();
    return {
      id: row.id,
      externalId: row.externalId,
      nombre: nombre || '—',
      nombres: row.nombres,
      apellidos: row.apellidos ?? undefined,
      empresa: row.empresaNombre ?? row.clienteEmpresa.empresa,
      empresaLogoUrl: row.clienteEmpresa.logoUrl ?? undefined,
      telefono: row.telefono ?? undefined,
      email: row.email ?? undefined,
      cargo: row.cargo ?? undefined,
      asesor: row.asesor ?? undefined,
      assignedTo: advisor?.id ?? row.asesor ?? 'unassigned',
      assignedToName: advisor?.name ?? row.asesor ?? 'Sin asesor',
      clienteEmpresaId: row.clienteEmpresaId,
    };
  }
}
