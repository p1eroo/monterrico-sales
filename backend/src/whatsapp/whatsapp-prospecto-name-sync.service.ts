import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlotaProspectosGateway } from '../flota-prospectos/flota-prospectos.gateway';
import { FlotaConductorMatchService } from '../flota-prospectos/flota-conductor-match.service';
import {
  shouldAcceptChatwootName,
  type ProspectoNameRef,
} from '../chatwoot/chatwoot-contact-name-sync.service';
import { EvogoClient } from './evogo.client';
import { WhatsappGateway } from './whatsapp.gateway';
import {
  extractPeMobile9,
  formatPeCelularE164,
  isPeruvianMobilePhone,
} from './wa-number.util';

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isPlaceholderProspectName(name: string | null | undefined, phoneDigits?: string): boolean {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return true;
  if (/^Contacto \d{9}$/i.test(trimmed)) return true;
  if (phoneDigits) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 8 && digits.slice(-9) === phoneDigits.slice(-9)) return true;
  }
  return false;
}

export function shouldAcceptWhatsappPushName(
  local: ProspectoNameRef & {
    whatsappPushName?: string | null;
    whatsappNamePushed?: string | null;
  },
  incomingPushName: string,
): boolean {
  const incoming = incomingPushName.trim();
  if (!incoming) return false;

  const localName = local.nombreCompleto?.trim() ?? '';
  if (localName && normalizeName(incoming) === normalizeName(localName)) {
    return false;
  }

  if (
    local.whatsappNamePushed?.trim() &&
    normalizeName(incoming) === normalizeName(local.whatsappNamePushed)
  ) {
    return false;
  }

  const prevWa = local.whatsappPushName?.trim();
  if (prevWa && normalizeName(incoming) !== normalizeName(prevWa) && !isPlaceholderProspectName(incoming)) {
    return true;
  }

  if (isPlaceholderProspectName(localName) && !isPlaceholderProspectName(incoming)) {
    return true;
  }

  return shouldAcceptChatwootName(local, incoming);
}

@Injectable()
export class WhatsappProspectoNameSyncService {
  private readonly logger = new Logger(WhatsappProspectoNameSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evogo: EvogoClient,
    private readonly prospectosGateway: FlotaProspectosGateway,
    private readonly whatsappGateway: WhatsappGateway,
    private readonly conductorMatch: FlotaConductorMatchService,
  ) {}

  private waNumberCandidates(rawPhone: string): string[] {
    const digits = rawPhone.replace(/\D/g, '');
    if (!digits) return [];
    const suffix9 = digits.slice(-9);
    const with51 =
      digits.startsWith('51') && digits.length >= 11
        ? digits
        : suffix9.length === 9
          ? `51${suffix9}`
          : digits;
    return [...new Set([digits, suffix9, with51].filter((value) => value.length >= 8))];
  }

  async syncOnInboundMatch(params: {
    prospectoId: string;
    peerDigits: string;
    pushName: string | null;
    evoInstanceName: string;
    instanceApiKey?: string | null;
  }): Promise<void> {
    const { prospectoId, peerDigits, pushName, evoInstanceName, instanceApiKey } = params;

    await this.linkOrphanMessages(prospectoId, peerDigits, evoInstanceName);

    const prospecto = await this.prisma.flotaProspecto.findUnique({
      where: { id: prospectoId },
      select: {
        id: true,
        nombreCompleto: true,
        dni: true,
        celular: true,
        whatsappPushName: true,
        whatsappNamePushed: true,
        whatsappNamePushedAt: true,
        eliminadoAt: true,
      },
    });
    if (!prospecto || prospecto.eliminadoAt) return;

    const phoneSuffix = peerDigits.slice(-9);
    const crmNameStored = prospecto.nombreCompleto.trim();
    let nextName = crmNameStored;
    const patch: {
      whatsappPushName?: string;
      nombreCompleto?: string;
      whatsappNamePushed?: string;
      whatsappNamePushedAt?: Date;
    } = {};

    if (pushName?.trim()) {
      patch.whatsappPushName = pushName.trim();
      if (
        isPlaceholderProspectName(crmNameStored, phoneSuffix) &&
        shouldAcceptWhatsappPushName(prospecto, pushName)
      ) {
        nextName = pushName.trim();
        patch.nombreCompleto = nextName;
      }
    }

    const currentPush = pushName?.trim() || prospecto.whatsappPushName?.trim() || '';
    const crmName = nextName.trim();
    const shouldPushToDevice =
      Boolean(instanceApiKey?.trim()) &&
      !isPlaceholderProspectName(crmName, phoneSuffix) &&
      (!currentPush || normalizeName(crmName) !== normalizeName(currentPush)) &&
      this.canRetryPush(prospecto, crmName);

    if (shouldPushToDevice && instanceApiKey) {
      const phone = prospecto.celular || peerDigits;
      const pushed = await this.evogo.saveContact({
        instanceApiKey,
        number: phone,
        name: crmName,
      });
      if (pushed.ok) {
        patch.whatsappNamePushed = crmName;
        patch.whatsappNamePushedAt = new Date();
        this.logger.log(
          `WhatsApp contacto ${phone} renombrado a "${crmName}" (prospecto ${prospectoId})`,
        );
      }
    }

    if (Object.keys(patch).length === 0) return;

    await this.prisma.flotaProspecto.update({
      where: { id: prospectoId },
      data: patch,
    });

    if (patch.nombreCompleto) {
      this.prospectosGateway.emitChange('updated', prospectoId);
      this.whatsappGateway.emitToContact(prospectoId, {
        type: 'prospecto_updated',
        contactId: prospectoId,
        name: patch.nombreCompleto,
      });
    }
  }

  async pushNameFromProspecto(prospectoId: string, newName: string): Promise<void> {
    const trimmed = newName?.trim();
    if (!trimmed || isPlaceholderProspectName(trimmed)) return;

    const prospecto = await this.prisma.flotaProspecto.findUnique({
      where: { id: prospectoId },
      select: {
        id: true,
        celular: true,
        whatsappNamePushed: true,
        whatsappNamePushedAt: true,
        eliminadoAt: true,
      },
    });
    if (!prospecto || prospecto.eliminadoAt) return;

    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { useForInbox: true, status: 'open' },
      select: { instanceApiKey: true },
    });
    if (!instance?.instanceApiKey) return;

    if (
      prospecto.whatsappNamePushed &&
      normalizeName(prospecto.whatsappNamePushed) === normalizeName(trimmed)
    ) {
      return;
    }

    const phone = prospecto.celular;
    if (!phone) return;

    const pushed = await this.evogo.saveContact({
      instanceApiKey: instance.instanceApiKey,
      number: phone,
      name: trimmed,
    });
    if (!pushed.ok) return;

    await this.prisma.flotaProspecto.update({
      where: { id: prospectoId },
      data: {
        whatsappNamePushed: trimmed,
        whatsappNamePushedAt: new Date(),
      },
    });

    this.logger.log(`WhatsApp sincronizado desde CRM → "${trimmed}" (prospecto ${prospectoId})`);
  }

  private canRetryPush(
    prospecto: { whatsappNamePushed?: string | null; whatsappNamePushedAt?: Date | null },
    crmName: string,
  ): boolean {
    if (
      !prospecto.whatsappNamePushed ||
      normalizeName(prospecto.whatsappNamePushed) !== normalizeName(crmName)
    ) {
      return true;
    }
    if (!prospecto.whatsappNamePushedAt) return true;
    const elapsed = Date.now() - prospecto.whatsappNamePushedAt.getTime();
    return elapsed > 5 * 60 * 1000;
  }

  async linkMessagesToProspecto(
    prospectoId: string,
    peerDigits: string,
    evoInstanceName: string,
  ): Promise<void> {
    await this.linkOrphanMessages(prospectoId, peerDigits, evoInstanceName);
  }

  /**
   * Vincula o crea prospecto para inbound Flota:
   * - Si ya existe activo en CRM → solo vincula mensajes huérfanos (la tabla manda).
   * - Si solo hay prospecto archivado → no reactivar ni duplicar (chat wa-).
   * - Si no hay registro → auto-crear prospecto nuevo.
   */
  async ensureProspectoForInbound(params: {
    peerDigits: string;
    pushName: string | null;
    evoInstanceName: string;
  }): Promise<{ id: string; nombreCompleto: string; celular: string | null } | null> {
    const { peerDigits, pushName, evoInstanceName } = params;

    if (!isPeruvianMobilePhone(peerDigits)) return null;

    const mobile9 = extractPeMobile9(peerDigits);
    const celular = formatPeCelularE164(peerDigits);
    if (!mobile9 || !celular) return null;

    const existing = await this.prisma.flotaProspecto.findFirst({
      where: {
        eliminadoAt: null,
        OR: [{ celular: { endsWith: mobile9 } }],
      },
      select: { id: true, nombreCompleto: true, celular: true },
    });
    if (existing) {
      await this.linkOrphanMessages(existing.id, peerDigits, evoInstanceName);
      return existing;
    }

    const archived = await this.prisma.flotaProspecto.findFirst({
      where: {
        eliminadoAt: { not: null },
        OR: [{ celular: { endsWith: mobile9 } }],
      },
      select: { id: true },
    });
    if (archived) {
      this.logger.log(
        `Inbound WhatsApp ${mobile9}: prospecto archivado ${archived.id}; chat wa- sin reactivar CRM`,
      );
      return null;
    }

    const trimmedPush = pushName?.trim() ?? '';
    const nombreCompleto =
      trimmedPush && !isPlaceholderProspectName(trimmedPush, mobile9)
        ? trimmedPush
        : `Contacto ${mobile9}`;

    const created = await this.prisma.flotaProspecto.create({
      data: {
        nombreCompleto,
        celular,
        estado: 'Nuevo',
        origen: 'WHATSAPP',
        whatsappPushName: trimmedPush || null,
        fechaRegistro: new Date(),
      },
      select: { id: true, nombreCompleto: true, celular: true, estado: true },
    });

    await this.linkOrphanMessages(created.id, peerDigits, evoInstanceName);

    await this.conductorMatch.afiliarSiConductor(created);

    this.prospectosGateway.emitChange('created', created.id);
    this.logger.log(
      `Prospecto auto-creado desde WhatsApp: ${created.id} (${created.celular}) → ${created.nombreCompleto}`,
    );

    return created;
  }

  private async linkOrphanMessages(
    prospectoId: string,
    peerDigits: string,
    evoInstanceName: string,
  ): Promise<void> {
    const candidates = this.waNumberCandidates(peerDigits);
    if (candidates.length === 0) return;

    const linked = await this.prisma.$executeRaw`
      UPDATE "CrmWhatsappMessage"
      SET "flotaProspectoId" = ${prospectoId}
      WHERE "flotaProspectoId" IS NULL
        AND "contactId" IS NULL
        AND "evoInstanceName" = ${evoInstanceName}
        AND (
          regexp_replace(COALESCE("fromWaId", ''), '\D', '', 'g') = ANY(${candidates}::text[])
          OR regexp_replace(COALESCE("toWaId", ''), '\D', '', 'g') = ANY(${candidates}::text[])
        )
    `;

    if (typeof linked === 'number' && linked > 0) {
      this.logger.log(
        `Unificados ${linked} mensajes huérfanos al prospecto ${prospectoId} (${peerDigits})`,
      );
    }
  }
}
