import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateClientDto } from './dto/update-client.dto';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';
import { STAGE_PROBABILITY_FALLBACK } from '../crm-config/crm-config.constants';

const CLIENT_STATUSES = ['activo', 'inactivo', 'potencial'] as const;

type Tx = Prisma.TransactionClient;

type CrmStageRow = { slug: string; enabled: boolean; probability: number };

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Misma regla que el alta automática: etapa habilitada al 100 % en BD, o fallback 100 %. */
  private static companySlugQualifiesForClient(
    etapaSlug: string,
    stages: CrmStageRow[],
  ): boolean {
    const s = etapaSlug.trim();
    if (!s) return false;
    const row = stages.find((st) => st.slug === s && st.enabled);
    if (row) return row.probability === 100;
    return STAGE_PROBABILITY_FALLBACK[s] === 100;
  }

  /** Slugs de etapa que hoy califican como «cliente» (para filtrar el listado). */
  private async qualifyingClientEtapaSlugs(): Promise<string[]> {
    const stages = await this.prisma.crmStage.findMany({
      select: { slug: true, enabled: true, probability: true },
    });
    const universe = new Set([
      ...stages.map((st) => st.slug),
      ...Object.keys(STAGE_PROBABILITY_FALLBACK),
    ]);
    return [...universe].filter((slug) =>
      ClientsService.companySlugQualifiesForClient(slug, stages),
    );
  }

  /**
   * Alta automática del registro Cliente: empresa en etapa «Activo» o con
   * probabilidad 100 % en el catálogo de etapas CRM (p. ej. etapa personalizada al 100 %).
   * Idempotente: no modifica fecha de creación si el cliente ya existía.
   */
  async ensureClientForCierreGanado(companyId: string): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.ensureClientForCierreGanadoTx(tx, companyId),
    );
  }

  /** @internal Usado también desde sync en transacción. */
  async ensureClientForCierreGanadoTx(tx: Tx, companyId: string): Promise<void> {
    const row = await tx.company.findUnique({
      where: { id: companyId },
      select: { etapa: true },
    });
    const etapa = row?.etapa?.trim() ?? '';
    if (!(await this.companyEtapaQualifiesForClient(tx, etapa))) return;
    await tx.client.upsert({
      where: { companyId },
      create: { companyId, status: 'activo' },
      update: {},
    });
  }

  private async companyEtapaQualifiesForClient(
    tx: Tx,
    etapaSlug: string,
  ): Promise<boolean> {
    const s = etapaSlug.trim();
    if (!s) return false;
    const stage = await tx.crmStage.findFirst({
      where: { slug: s, enabled: true },
      select: { probability: true },
    });
    if (stage) return stage.probability === 100;
    return STAGE_PROBABILITY_FALLBACK[s] === 100;
  }

  async findAll(scope?: CrmDataScope) {
    const etapaSlugs = await this.qualifyingClientEtapaSlugs();
    const rows = await this.prisma.client.findMany({
      where: {
        company: mergeCompanyScope({ etapa: { in: etapaSlugs } }, scope),
      },
      include: {
        company: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map((r) => this.mapToApi(r)));
  }

  async update(
    clientId: string,
    dto: UpdateClientDto,
    scope?: CrmDataScope,
  ) {
    const gate = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        company: mergeCompanyScope({}, scope),
      },
      select: { id: true },
    });
    if (!gate) {
      throw new NotFoundException('Cliente no encontrado');
    }
    const data: Prisma.ClientUpdateInput = {};
    if (dto.status !== undefined) {
      const s = dto.status?.trim();
      if (!s || !CLIENT_STATUSES.includes(s as (typeof CLIENT_STATUSES)[number])) {
        throw new BadRequestException(
          'Estado inválido: use activo, inactivo o potencial',
        );
      }
      data.status = s;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes?.trim() || null;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }
    try {
      const updated = await this.prisma.client.update({
        where: { id: clientId },
        data,
        include: {
          company: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      });
      return this.mapToApi(updated);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundException('Cliente no encontrado');
      }
      throw e;
    }
  }

  private async mapToApi(row: {
    id: string;
    companyId: string;
    status: string;
    notes: string | null;
    createdAt: Date;
    company: {
      id: string;
      urlSlug: string;
      name: string;
      rubro: string | null;
      tipo: string | null;
      telefono: string | null;
      correo: string | null;
      facturacionEstimada: number;
      assignedTo: string | null;
      user: { id: string; name: string } | null;
    };
  }) {
    const primary = await this.getPrimaryContactForCompany(row.companyId);
    const advisorId = row.company.assignedTo ?? row.company.user?.id ?? '';
    const advisorName = row.company.user?.name ?? 'Sin asignar';

    return {
      id: row.id,
      companyId: row.company.id,
      companyUrlSlug: row.company.urlSlug,
      company: row.company.name,
      companyRubro: row.company.rubro ?? undefined,
      companyTipo: row.company.tipo ?? undefined,
      contactName: primary?.name ?? '',
      phone: row.company.telefono?.trim() || primary?.telefono || '',
      email:
        row.company.correo?.trim() || primary?.correo || '',
      status: row.status,
      assignedTo: advisorId,
      assignedToName: advisorName,
      service: '',
      createdAt: row.createdAt.toISOString().slice(0, 10),
      totalRevenue: row.company.facturacionEstimada,
      notes: row.notes ?? undefined,
      lastActivity: undefined as string | undefined,
    };
  }

  private async getPrimaryContactForCompany(
    companyId: string,
    db: Pick<
      PrismaService,
      'companyOpportunity' | 'contactOpportunity' | 'companyContact'
    > = this.prisma,
  ) {
    const opLinks = await db.companyOpportunity.findMany({
      where: { companyId },
      include: { opportunity: { select: { id: true, amount: true } } },
    });
    if (opLinks.length > 0) {
      const best = opLinks.reduce((a, b) =>
        a.opportunity.amount >= b.opportunity.amount ? a : b,
      );
      const coRows = await db.contactOpportunity.findMany({
        where: { opportunityId: best.opportunity.id },
        include: {
          contact: {
            select: { id: true, name: true, telefono: true, correo: true },
          },
        },
      });
      const companyContactIds = new Set(
        (
          await db.companyContact.findMany({
            where: { companyId },
            select: { contactId: true },
          })
        ).map((x) => x.contactId),
      );
      const preferred = coRows.find((x) => companyContactIds.has(x.contactId));
      const pick = preferred ?? coRows[0];
      return pick?.contact ?? null;
    }
    const cc = await db.companyContact.findFirst({
      where: { companyId },
      include: {
        contact: {
          select: { id: true, name: true, telefono: true, correo: true },
        },
      },
    });
    return cc?.contact ?? null;
  }
}
