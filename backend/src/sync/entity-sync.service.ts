import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { slugifyForUrl } from '../common/url-slug.util';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { AuditDetailService } from '../audit-detail/audit-detail.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import type { ActivityActor } from '../activity-logs/activity-logs.types';
import {
  COMPANY_FIELD_LABELS,
  CONTACT_FIELD_LABELS,
  OPPORTUNITY_FIELD_LABELS,
} from '../audit-detail/audit-field-labels';

type Tx = Prisma.TransactionClient;

type EtapaSyncRecord = {
  module: 'empresas' | 'contactos' | 'oportunidades';
  entityType: 'Empresa' | 'Contacto' | 'Oportunidad';
  entityId: string;
  entityName: string;
  oldEtapa: string;
  newEtapa: string;
};

/**
 * Sincronización empresa ↔ contactos ↔ oportunidad principal vinculada.
 * La oportunidad principal por empresa es la de mayor probabilidad de etapa (catálogo);
 * solo ella alinea Company y contactos; las demás oportunidades de la empresa no se pisan.
 * La fuente de contacto principal y oportunidad principal se alinea con la empresa al propagar
 * desde empresa; desde contacto u oportunidad principal rige la lógica existente.
 * Usar prisma directo aquí (no pasar por ContactsService.update) para evitar recursión.
 */
@Injectable()
export class EntitySyncService {
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmConfig: CrmConfigService,
    private readonly auditDetail: AuditDetailService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  private lockCompany(companyId: string): boolean {
    if (this.inFlight.has(companyId)) return false;
    this.inFlight.add(companyId);
    return true;
  }

  private unlockCompany(companyId: string) {
    this.inFlight.delete(companyId);
  }

  private queueEtapaChange(
    pending: EtapaSyncRecord[],
    row: Omit<EtapaSyncRecord, 'oldEtapa' | 'newEtapa'> & {
      oldEtapa: string;
      newEtapa: string;
    },
  ) {
    const oldEtapa = row.oldEtapa.trim();
    const newEtapa = row.newEtapa.trim();
    if (!oldEtapa && !newEtapa) return;
    if (oldEtapa === newEtapa) return;
    pending.push({ ...row, oldEtapa, newEtapa });
  }

  private etapaDescription(
    entityType: EtapaSyncRecord['entityType'],
    oldEtapa: string,
    newEtapa: string,
  ): string {
    switch (entityType) {
      case 'Empresa':
        return `Etapa de la empresa: ${oldEtapa} → ${newEtapa}`;
      case 'Contacto':
        return `Etapa del contacto: ${oldEtapa} → ${newEtapa}`;
      case 'Oportunidad':
        return `Etapa de la oportunidad: ${oldEtapa} → ${newEtapa}`;
    }
  }

  private fieldLabel(entityType: EtapaSyncRecord['entityType']): string {
    switch (entityType) {
      case 'Empresa':
        return COMPANY_FIELD_LABELS.etapa;
      case 'Contacto':
        return CONTACT_FIELD_LABELS.etapa;
      case 'Oportunidad':
        return OPPORTUNITY_FIELD_LABELS.etapa;
    }
  }

  private async recordPendingEtapaChanges(
    actor: ActivityActor | null | undefined,
    pending: EtapaSyncRecord[],
  ): Promise<void> {
    for (const row of pending) {
      const description = this.etapaDescription(
        row.entityType,
        row.oldEtapa,
        row.newEtapa,
      );
      await this.auditDetail.record(actor ?? null, {
        action: 'cambiar_etapa',
        module: row.module,
        entityType: row.entityType,
        entityId: row.entityId,
        entityName: row.entityName,
        entries: [
          {
            fieldKey: 'etapa',
            fieldLabel: this.fieldLabel(row.entityType),
            oldValue: row.oldEtapa,
            newValue: row.newEtapa,
          },
        ],
      });
      await this.activityLogs.record(actor ?? null, {
        action: 'cambiar_etapa',
        module: row.module,
        entityType: row.entityType,
        entityId: row.entityId,
        entityName: row.entityName,
        description,
      });
    }
  }

  /** Tras crear/editar un contacto vinculado: empresa y demás contactos/opps alinean a ese contacto. */
  async propagateFromContact(
    companyId: string,
    contactId: string,
    actor?: ActivityActor | null,
  ): Promise<void> {
    if (!this.lockCompany(companyId)) return;
    try {
      const pending: EtapaSyncRecord[] = [];
      await this.prisma.$transaction(async (tx) => {
        const contact = await tx.contact.findUnique({ where: { id: contactId } });
        if (!contact) return;
        const link = await tx.companyContact.findUnique({
          where: {
            companyId_contactId: { companyId, contactId },
          },
        });
        if (!link) return;

        await this.applyContactSnapshot(tx, companyId, contact, pending);
      });
      await this.recordPendingEtapaChanges(actor, pending);
    } finally {
      this.unlockCompany(companyId);
    }
  }

  /** Tras editar empresa: contacto principal (o único) y oportunidad principal alinean campos comerciales. */
  async propagateFromCompany(
    companyId: string,
    actor?: ActivityActor | null,
  ): Promise<void> {
    if (!this.lockCompany(companyId)) return;
    try {
      const pending: EtapaSyncRecord[] = [];
      await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.findUnique({ where: { id: companyId } });
        if (!company) return;
        await this.applyCompanySnapshot(tx, companyId, company, pending);
      });
      await this.recordPendingEtapaChanges(actor, pending);
    } finally {
      this.unlockCompany(companyId);
    }
  }

  /** Tras crear/editar oportunidad vinculada a empresa: empresa y contactos/opps alinean a la opp. */
  async propagateFromOpportunity(
    companyId: string,
    opportunityId: string,
    actor?: ActivityActor | null,
  ): Promise<void> {
    if (!this.lockCompany(companyId)) return;
    try {
      const pending: EtapaSyncRecord[] = [];
      await this.prisma.$transaction(async (tx) => {
        const opp = await tx.opportunity.findUnique({ where: { id: opportunityId } });
        if (!opp) return;
        const link = await tx.companyOpportunity.findUnique({
          where: {
            companyId_opportunityId: { companyId, opportunityId },
          },
        });
        if (!link) return;

        await this.applyOpportunitySnapshot(tx, companyId, opp, pending);
      });
      await this.recordPendingEtapaChanges(actor, pending);
    } finally {
      this.unlockCompany(companyId);
    }
  }

  /** Todas las empresas vinculadas a la oportunidad (por si hay varias). */
  async propagateFromOpportunityAllCompanies(
    opportunityId: string,
    actor?: ActivityActor | null,
  ): Promise<void> {
    const links = await this.prisma.companyOpportunity.findMany({
      where: { opportunityId },
      select: { companyId: true },
    });
    for (const { companyId } of links) {
      await this.propagateFromOpportunity(companyId, opportunityId, actor);
    }
  }

  /**
   * Oportunidad “principal” para la empresa: mayor probabilidad de etapa (catálogo).
   * Empate: mayor monto, luego id estable.
   */
  private async resolvePrimaryOpportunityIdForCompanyTx(
    tx: Tx,
    companyId: string,
  ): Promise<string | null> {
    const coRows = await tx.companyOpportunity.findMany({
      where: { companyId },
      select: { opportunityId: true },
    });
    if (coRows.length === 0) return null;
    const ids = coRows.map((r) => r.opportunityId);
    const opps = await tx.opportunity.findMany({
      where: { id: { in: ids } },
      select: { id: true, etapa: true, amount: true },
    });
    if (opps.length === 0) return null;

    type Scored = { id: string; prob: number; amount: number };
    const scored: Scored[] = [];
    for (const o of opps) {
      const p = await this.crmConfig.resolveOpportunityProbability(o.etapa);
      const prob = Math.round(Number(p) || 0);
      scored.push({ id: o.id, prob, amount: Number(o.amount) || 0 });
    }
    scored.sort((a, b) => {
      if (b.prob !== a.prob) return b.prob - a.prob;
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.id.localeCompare(b.id);
    });
    return scored[0]?.id ?? null;
  }

  /**
   * Contacto principal de la empresa: `isPrimary` en el vínculo; si hay uno solo, ese;
   * si hay varios sin principal, el vinculado a la oportunidad principal de la empresa.
   */
  private async resolvePrimaryContactIdForCompanyTx(
    tx: Tx,
    companyId: string,
  ): Promise<string | null> {
    const ccRows = await tx.companyContact.findMany({
      where: { companyId },
      select: { contactId: true, isPrimary: true },
    });
    if (ccRows.length === 0) return null;
    if (ccRows.length === 1) return ccRows[0].contactId;

    const flagged = ccRows.filter((r) => r.isPrimary);
    if (flagged.length >= 1) {
      return flagged[0].contactId;
    }

    const primaryOppId =
      await this.resolvePrimaryOpportunityIdForCompanyTx(tx, companyId);
    if (!primaryOppId) return null;

    const companyContactIds = new Set(ccRows.map((r) => r.contactId));
    const oppContacts = await tx.contactOpportunity.findMany({
      where: { opportunityId: primaryOppId },
      select: { contactId: true },
    });
    const linked = oppContacts.find((oc) => companyContactIds.has(oc.contactId));
    return linked?.contactId ?? null;
  }

  private async applyContactSnapshot(
    tx: Tx,
    companyId: string,
    contact: {
      etapa: string;
      fuente: string;
      assignedTo: string | null;
      estimatedValue: number;
      name: string;
    },
    pending: EtapaSyncRecord[],
  ) {
    const fact = contact.estimatedValue;
    const etapa = contact.etapa;
    const assignedTo = contact.assignedTo;

    const primaryOppIdForFuente =
      await this.resolvePrimaryOpportunityIdForCompanyTx(tx, companyId);
    let fuenteForCompany = await this.crmConfig.normalizeLeadSourceOrDefault(contact.fuente);
    if (primaryOppIdForFuente) {
      const po = await tx.opportunity.findUnique({
        where: { id: primaryOppIdForFuente },
        select: { fuente: true },
      });
      fuenteForCompany = await this.crmConfig.normalizeLeadSourceOrDefault(po?.fuente);
    }

    const companyBefore = await tx.company.findUnique({
      where: { id: companyId },
      select: { etapa: true, name: true },
    });
    if (companyBefore) {
      await tx.company.update({
        where: { id: companyId },
        data: {
          ...(fact > 0 && { facturacionEstimada: fact }),
          fuente: fuenteForCompany,
          etapa,
          assignedTo,
        },
      });
      this.queueEtapaChange(pending, {
        module: 'empresas',
        entityType: 'Empresa',
        entityId: companyId,
        entityName: companyBefore.name,
        oldEtapa: companyBefore.etapa,
        newEtapa: etapa,
      });
    }

    const ccRows = await tx.companyContact.findMany({
      where: { companyId },
      select: { contactId: true },
    });
    for (const { contactId: cid } of ccRows) {
      const contactBefore = await tx.contact.findUnique({
        where: { id: cid },
        select: { etapa: true, name: true },
      });
      if (!contactBefore) continue;
      await tx.contact.update({
        where: { id: cid },
        data: {
          etapa,
          fuente: contact.fuente,
          assignedTo,
          estimatedValue: fact,
        },
      });
      this.queueEtapaChange(pending, {
        module: 'contactos',
        entityType: 'Contacto',
        entityId: cid,
        entityName: contactBefore.name,
        oldEtapa: contactBefore.etapa,
        newEtapa: etapa,
      });
    }

    const primaryOppId =
      await this.resolvePrimaryOpportunityIdForCompanyTx(tx, companyId);
    if (primaryOppId) {
      await this.updateOppCommercial(tx, primaryOppId, {
        amount: fact,
        etapa,
        assignedTo,
      }, pending);
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
      name: string;
    },
    pending: EtapaSyncRecord[],
  ) {
    const fact = company.facturacionEstimada;
    const etapa = company.etapa;
    const assignedTo = company.assignedTo;
    const syncFuente = await this.crmConfig.normalizeLeadSourceOrDefault(
      company.fuente,
    );

    const primaryContactId =
      await this.resolvePrimaryContactIdForCompanyTx(tx, companyId);
    if (primaryContactId) {
      const contactBefore = await tx.contact.findUnique({
        where: { id: primaryContactId },
        select: { etapa: true, name: true },
      });
      if (contactBefore) {
        await tx.contact.update({
          where: { id: primaryContactId },
          data: {
            etapa,
            fuente: syncFuente,
            assignedTo,
            estimatedValue: fact,
          },
        });
        this.queueEtapaChange(pending, {
          module: 'contactos',
          entityType: 'Contacto',
          entityId: primaryContactId,
          entityName: contactBefore.name,
          oldEtapa: contactBefore.etapa,
          newEtapa: etapa,
        });
      }
    }

    const primaryOppId =
      await this.resolvePrimaryOpportunityIdForCompanyTx(tx, companyId);
    if (primaryOppId) {
      await this.updateOppCommercial(tx, primaryOppId, {
        amount: fact,
        etapa,
        assignedTo,
        fuente: syncFuente,
      }, pending);
    }
  }

  private async applyOpportunitySnapshot(
    tx: Tx,
    companyId: string,
    _triggerOpp: {
      id: string;
      amount: number;
      etapa: string;
      assignedTo: string | null;
    },
    pending: EtapaSyncRecord[],
  ) {
    const primaryId =
      await this.resolvePrimaryOpportunityIdForCompanyTx(tx, companyId);
    if (!primaryId) return;

    const opp = await tx.opportunity.findUnique({
      where: { id: primaryId },
      select: {
        id: true,
        amount: true,
        etapa: true,
        assignedTo: true,
        fuente: true,
      },
    });
    if (!opp) return;

    const fact = opp.amount;
    const etapa = opp.etapa;
    const assignedTo = opp.assignedTo;
    const fuente = await this.crmConfig.normalizeLeadSourceOrDefault(opp.fuente);

    const companyBefore = await tx.company.findUnique({
      where: { id: companyId },
      select: { etapa: true, name: true },
    });
    if (companyBefore) {
      await tx.company.update({
        where: { id: companyId },
        data: {
          facturacionEstimada: fact,
          fuente,
          etapa,
          assignedTo,
        },
      });
      this.queueEtapaChange(pending, {
        module: 'empresas',
        entityType: 'Empresa',
        entityId: companyId,
        entityName: companyBefore.name,
        oldEtapa: companyBefore.etapa,
        newEtapa: etapa,
      });
    }

    const ccRows = await tx.companyContact.findMany({
      where: { companyId },
      select: { contactId: true },
    });
    for (const { contactId: cid } of ccRows) {
      const contactBefore = await tx.contact.findUnique({
        where: { id: cid },
        select: { etapa: true, name: true },
      });
      if (!contactBefore) continue;
      await tx.contact.update({
        where: { id: cid },
        data: {
          etapa,
          fuente,
          assignedTo,
          estimatedValue: fact,
        },
      });
      this.queueEtapaChange(pending, {
        module: 'contactos',
        entityType: 'Contacto',
        entityId: cid,
        entityName: contactBefore.name,
        oldEtapa: contactBefore.etapa,
        newEtapa: etapa,
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
      fuente?: string;
    },
    pending: EtapaSyncRecord[],
  ) {
    const oppBefore = await tx.opportunity.findUnique({
      where: { id: opportunityId },
      select: { etapa: true, title: true },
    });
    if (!oppBefore) return;

    const status = this.statusFromEtapa(patch.etapa);
    const probability = await this.crmConfig.resolveOpportunityProbability(
      patch.etapa,
    );
    await tx.opportunity.update({
      where: { id: opportunityId },
      data: {
        amount: patch.amount,
        etapa: patch.etapa,
        assignedTo: patch.assignedTo,
        status,
        probability,
        ...(patch.fuente !== undefined ? { fuente: patch.fuente } : {}),
      },
    });
    this.queueEtapaChange(pending, {
      module: 'oportunidades',
      entityType: 'Oportunidad',
      entityId: opportunityId,
      entityName: oppBefore.title,
      oldEtapa: oppBefore.etapa,
      newEtapa: patch.etapa,
    });
  }

  private statusFromEtapa(etapa: string): string {
    if (etapa === 'activo') {
      return 'ganada';
    }
    if (['cierre_perdido', 'inactivo'].includes(etapa)) {
      return 'perdida';
    }
    return 'abierta';
  }

  /**
   * Reutiliza una oportunidad ya vinculada a la empresa con el mismo título (sin distinguir mayúsculas).
   * Si no existe, crea una nueva vinculada solo a la empresa.
   */
  async ensureOpportunityForCompany(
    companyId: string,
    defaults: {
      title: string;
      amount: number;
      etapa: string;
      assignedTo: string | null;
      expectedCloseDate: Date | null;
    },
  ): Promise<string> {
    const titleTrim = defaults.title?.trim() || 'Oportunidad';
    const oppForCompany = await this.prisma.opportunity.findFirst({
      where: {
        companies: { some: { companyId } },
        title: { equals: titleTrim, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (oppForCompany) return oppForCompany.id;

    const probability = await this.crmConfig.resolveOpportunityProbability(
      defaults.etapa,
    );
    const status = this.statusFromEtapa(defaults.etapa);

    const opp = await this.prisma.$transaction(async (tx) => {
      const base = slugifyForUrl(titleTrim);
      let urlSlug = base;
      let n = 0;
      for (;;) {
        const clash = await tx.opportunity.findFirst({
          where: { urlSlug },
        });
        if (!clash) break;
        n += 1;
        urlSlug = `${base}-${n}`;
      }
      const o = await tx.opportunity.create({
        data: {
          urlSlug,
          title: titleTrim,
          amount: defaults.amount,
          etapa: defaults.etapa,
          status,
          probability,
          priority: 'media',
          expectedCloseDate: defaults.expectedCloseDate,
          assignedTo: defaults.assignedTo,
          fuente: 'base',
        },
      });
      await tx.companyOpportunity.create({
        data: { companyId, opportunityId: o.id },
      });
      return o;
    });

    return opp.id;
  }

  async ensureContactLinkedToOpportunity(
    contactId: string,
    opportunityId: string,
  ): Promise<void> {
    const already = await this.prisma.contactOpportunity.findFirst({
      where: { contactId, opportunityId },
      select: { id: true },
    });
    if (already) return;
    await this.prisma.contactOpportunity.create({
      data: { contactId, opportunityId },
    });
  }
}
