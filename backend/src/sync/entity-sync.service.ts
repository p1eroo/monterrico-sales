import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/**
 * Sincronización fuerte empresa ↔ contactos ↔ oportunidades vinculadas.
 * Origen del cambio define el snapshot: se copia a Company y al resto del grafo.
 * Usar prisma directo aquí (no pasar por ContactsService.update) para evitar recursión.
 */
@Injectable()
export class EntitySyncService {
  private readonly inFlight = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  private lockCompany(companyId: string): boolean {
    if (this.inFlight.has(companyId)) return false;
    this.inFlight.add(companyId);
    return true;
  }

  private unlockCompany(companyId: string) {
    this.inFlight.delete(companyId);
  }

  /** Tras crear/editar un contacto vinculado: empresa y demás contactos/opps alinean a ese contacto. */
  async propagateFromContact(companyId: string, contactId: string): Promise<void> {
    if (!this.lockCompany(companyId)) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        const contact = await tx.contact.findUnique({ where: { id: contactId } });
        if (!contact) return;
        const link = await tx.companyContact.findUnique({
          where: {
            companyId_contactId: { companyId, contactId },
          },
        });
        if (!link) return;

        await this.applyContactSnapshot(tx, companyId, contact);
      });
    } finally {
      this.unlockCompany(companyId);
    }
  }

  /** Tras editar empresa: todos los contactos y opps vinculados copian campos comerciales. */
  async propagateFromCompany(companyId: string): Promise<void> {
    if (!this.lockCompany(companyId)) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.findUnique({ where: { id: companyId } });
        if (!company) return;
        await this.applyCompanySnapshot(tx, companyId, company);
      });
    } finally {
      this.unlockCompany(companyId);
    }
  }

  /** Tras crear/editar oportunidad vinculada a empresa: empresa y contactos/opps alinean a la opp. */
  async propagateFromOpportunity(
    companyId: string,
    opportunityId: string,
  ): Promise<void> {
    if (!this.lockCompany(companyId)) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        const opp = await tx.opportunity.findUnique({ where: { id: opportunityId } });
        if (!opp) return;
        const link = await tx.companyOpportunity.findUnique({
          where: {
            companyId_opportunityId: { companyId, opportunityId },
          },
        });
        if (!link) return;

        await this.applyOpportunitySnapshot(tx, companyId, opp);
      });
    } finally {
      this.unlockCompany(companyId);
    }
  }

  /** Todas las empresas vinculadas a la oportunidad (por si hay varias). */
  async propagateFromOpportunityAllCompanies(opportunityId: string): Promise<void> {
    const links = await this.prisma.companyOpportunity.findMany({
      where: { opportunityId },
      select: { companyId: true },
    });
    for (const { companyId } of links) {
      await this.propagateFromOpportunity(companyId, opportunityId);
    }
  }

  private async applyContactSnapshot(
    tx: Tx,
    companyId: string,
    contact: {
      etapa: string;
      fuente: string;
      assignedTo: string | null;
      estimatedValue: number;
    },
  ) {
    const fact = contact.estimatedValue;
    const fuente = contact.fuente;
    const etapa = contact.etapa;
    const assignedTo = contact.assignedTo;

    await tx.company.update({
      where: { id: companyId },
      data: {
        facturacionEstimada: fact,
        fuente,
        etapa,
        assignedTo,
      },
    });

    const ccRows = await tx.companyContact.findMany({
      where: { companyId },
      select: { contactId: true },
    });
    for (const { contactId: cid } of ccRows) {
      await tx.contact.update({
        where: { id: cid },
        data: {
          etapa,
          fuente,
          assignedTo,
          estimatedValue: fact,
        },
      });
    }

    const coRows = await tx.companyOpportunity.findMany({
      where: { companyId },
      select: { opportunityId: true },
    });
    for (const { opportunityId } of coRows) {
      await this.updateOppCommercial(tx, opportunityId, {
        amount: fact,
        etapa,
        assignedTo,
      });
    }
  }

  private async applyCompanySnapshot(
    tx: Tx,
    companyId: string,
    company: {
      facturacionEstimada: number;
      fuente: string | null;
      etapa: string;
      assignedTo: string | null;
    },
  ) {
    const fact = company.facturacionEstimada;
    const fuente = company.fuente ?? 'base';
    const etapa = company.etapa;
    const assignedTo = company.assignedTo;

    const ccRows = await tx.companyContact.findMany({
      where: { companyId },
      select: { contactId: true },
    });
    for (const { contactId: cid } of ccRows) {
      await tx.contact.update({
        where: { id: cid },
        data: {
          etapa,
          fuente,
          assignedTo,
          estimatedValue: fact,
        },
      });
    }

    const coRows = await tx.companyOpportunity.findMany({
      where: { companyId },
      select: { opportunityId: true },
    });
    for (const { opportunityId } of coRows) {
      await this.updateOppCommercial(tx, opportunityId, {
        amount: fact,
        etapa,
        assignedTo,
      });
    }
  }

  private async applyOpportunitySnapshot(
    tx: Tx,
    companyId: string,
    opp: {
      id: string;
      amount: number;
      etapa: string;
      assignedTo: string | null;
    },
  ) {
    const fact = opp.amount;
    const etapa = opp.etapa;
    const assignedTo = opp.assignedTo;

    const firstLink = await tx.contactOpportunity.findFirst({
      where: { opportunityId: opp.id },
      include: { contact: { select: { fuente: true } } },
    });
    let fuente = firstLink?.contact?.fuente?.trim() ?? '';
    if (!fuente) {
      const comp = await tx.company.findUnique({
        where: { id: companyId },
        select: { fuente: true },
      });
      fuente = comp?.fuente?.trim() ?? 'base';
    }
    if (!fuente) fuente = 'base';

    await tx.company.update({
      where: { id: companyId },
      data: {
        facturacionEstimada: fact,
        fuente,
        etapa,
        assignedTo,
      },
    });

    const ccRows = await tx.companyContact.findMany({
      where: { companyId },
      select: { contactId: true },
    });
    for (const { contactId: cid } of ccRows) {
      await tx.contact.update({
        where: { id: cid },
        data: {
          etapa,
          fuente,
          assignedTo,
          estimatedValue: fact,
        },
      });
    }

    const coRows = await tx.companyOpportunity.findMany({
      where: { companyId },
      select: { opportunityId: true },
    });
    for (const { opportunityId } of coRows) {
      await this.updateOppCommercial(tx, opportunityId, {
        amount: fact,
        etapa,
        assignedTo,
      });
    }
  }

  private async updateOppCommercial(
    tx: Tx,
    opportunityId: string,
    patch: {
      amount: number;
      etapa: string;
      assignedTo: string | null;
    },
  ) {
    const status = this.statusFromEtapa(patch.etapa);
    const probability = this.probabilityForEtapa(patch.etapa);
    await tx.opportunity.update({
      where: { id: opportunityId },
      data: {
        amount: patch.amount,
        etapa: patch.etapa,
        assignedTo: patch.assignedTo,
        status,
        probability,
      },
    });
  }

  private probabilityForEtapa(etapa: string): number {
    const ETAPA_PROBABILITY: Record<string, number> = {
      lead: 0,
      contacto: 10,
      reunion_agendada: 30,
      reunion_efectiva: 40,
      propuesta_economica: 50,
      negociacion: 70,
      licitacion: 75,
      licitacion_etapa_final: 85,
      cierre_ganado: 90,
      firma_contrato: 95,
      activo: 100,
      cierre_perdido: -1,
      inactivo: -5,
    };
    return ETAPA_PROBABILITY[etapa] ?? 0;
  }

  private statusFromEtapa(etapa: string): string {
    if (['activo', 'cierre_ganado', 'firma_contrato'].includes(etapa)) {
      return 'ganada';
    }
    if (['cierre_perdido', 'inactivo'].includes(etapa)) {
      return 'perdida';
    }
    return 'abierta';
  }

  /**
   * Crea oportunidad + vínculos si no existe ya una que una este contacto y empresa.
   */
  async ensureOpportunityForContactCompany(
    contactId: string,
    companyId: string,
    defaults: {
      title: string;
      amount: number;
      etapa: string;
      assignedTo: string | null;
      expectedCloseDate: Date | null;
    },
  ): Promise<string | null> {
    const existing = await this.prisma.opportunity.findFirst({
      where: {
        AND: [
          { contacts: { some: { contactId } } },
          { companies: { some: { companyId } } },
        ],
      },
      select: { id: true },
    });
    if (existing) return null;

    const probability = this.probabilityForEtapa(defaults.etapa);
    const status = this.statusFromEtapa(defaults.etapa);

    const opp = await this.prisma.$transaction(async (tx) => {
      const o = await tx.opportunity.create({
        data: {
          title: defaults.title,
          amount: defaults.amount,
          etapa: defaults.etapa,
          status,
          probability,
          priority: 'media',
          expectedCloseDate: defaults.expectedCloseDate,
          assignedTo: defaults.assignedTo,
        },
      });
      await tx.contactOpportunity.create({
        data: { contactId, opportunityId: o.id },
      });
      await tx.companyOpportunity.create({
        data: { companyId, opportunityId: o.id },
      });
      return o;
    });

    return opp.id;
  }
}
