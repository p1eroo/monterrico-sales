import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { EvogoClient } from './evogo.client';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import { digitsOnly, normalizePeWaNumber } from './wa-number.util';
import {
  parseMessageEventData,
  parseMessageMedia,
  parseMessagesUpdateEventData,
  parseReceiptEventData,
  readEvolutionWebhookEvent,
  readMessageEventPayload,
  stripHeavyPayload,
} from './evolution-webhook.util';
import { WhatsappGateway } from './whatsapp.gateway';

type JsonRecord = Record<string, unknown>;
type WhatsappMessageAttachmentDto = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'file';
  url: string | null;
};
type WhatsappListItemRow = {
  id: string;
  direction: string;
  body: string;
  fromWaId: string;
  toWaId: string;
  createdAt: Date;
  waMessageId: string | null;
  evoInstanceName: string | null;
  waOutboundStatus: string | null;
};
type WhatsappListItemDto = Omit<WhatsappListItemRow, 'createdAt'> & {
  createdAt: string;
  attachments: WhatsappMessageAttachmentDto[];
};
type LooseContactMatchRow = {
  id: string;
  name: string;
  telefono: string | null;
  assignedTo: string | null;
};
type WhatsappInstanceRow = {
  id: string;
  userId: string;
  instanceName: string;
  instanceApiKey: string;
  evoInstanceId: string | null;
  displayLineId: string | null;
  status: string;
  qrCode: string | null;
  qrText: string | null;
  pairingCode: string | null;
  qrGeneratedAt: Date | null;
  qrExpiresAt: Date | null;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function asRecord(v: unknown): JsonRecord | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as JsonRecord)
    : null;
}

const WHATSAPP_LIST_SELECT = {
  id: true,
  direction: true,
  body: true,
  fromWaId: true,
  toWaId: true,
  createdAt: true,
  waMessageId: true,
  evoInstanceName: true,
  waOutboundStatus: true,
} as const;

const WHATSAPP_INSTANCE_SELECT = {
  id: true,
  userId: true,
  instanceName: true,
  instanceApiKey: true,
  evoInstanceId: true,
  displayLineId: true,
  status: true,
  qrCode: true,
  qrText: true,
  pairingCode: true,
  qrGeneratedAt: true,
  qrExpiresAt: true,
  lastConnectedAt: true,
  lastDisconnectedAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly evogo: EvogoClient,
    private readonly contactsService: ContactsService,
    private readonly notifications: NotificationsService,
    private readonly files: FilesService,
    private readonly gateway: WhatsappGateway,
  ) {}

  private defaultInstanceKey(): string {
    const k = this.config.get<string>('EVOGO_INSTANCE_API_KEY')?.trim();
    if (!k) {
      throw new ServiceUnavailableException(
        'WhatsApp (Evolution GO) no está configurado: falta EVOGO_INSTANCE_API_KEY',
      );
    }
    return k;
  }

  private defaultInstanceId(): string {
    return this.config.get<string>('EVOGO_INSTANCE_ID')?.trim() || 'crm-send';
  }

  private defaultInstanceName(): string | null {
    return this.config.get<string>('EVOGO_INSTANCE_NAME')?.trim() || null;
  }

  private displaySenderId(): string {
    return (
      this.config.get<string>('EVOGO_DISPLAY_LINE_ID')?.trim() || 'evolution-go'
    );
  }

  private personalConnectionsEnabled(): boolean {
    return Boolean(
      this.config.get<string>('EVOGO_MANAGER_API_KEY')?.trim() &&
        this.config.get<string>('EVOGO_WEBHOOK_URL')?.trim(),
    );
  }

  private webhookUrl(): string {
    const raw = this.config.get<string>('EVOGO_WEBHOOK_URL')?.trim();
    if (!raw) {
      throw new ServiceUnavailableException(
        'Falta EVOGO_WEBHOOK_URL para conectar instancias personales de WhatsApp',
      );
    }
    const secret = this.config.get<string>('EVOGO_WEBHOOK_SECRET')?.trim();
    if (!secret || /(?:\?|&)token=/.test(raw)) {
      return raw;
    }
    return `${raw}${raw.includes('?') ? '&' : '?'}token=${encodeURIComponent(secret)}`;
  }

  private normalizeSlug(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || 'usuario';
  }

  private async preferredInstanceSlug(
    userId: string,
    userName: string,
  ): Promise<string> {
    const credentials = await this.prisma.account.findFirst({
      where: {
        userId,
        provider: 'credentials',
      },
      select: {
        providerId: true,
      },
    });
    const usernameSlug = this.normalizeSlug(credentials?.providerId || '').slice(0, 24);
    if (usernameSlug && usernameSlug !== 'usuario') {
      return usernameSlug;
    }
    return this.normalizeSlug(userName).slice(0, 24);
  }

  private buildInstanceName(slug: string, userId: string): string {
    if (slug && slug !== 'usuario') {
      return `crm-${slug}`;
    }
    const suffix = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toLowerCase();
    return `crm-${suffix || 'user'}`;
  }

  private qrExpiryDate(base = new Date()): Date {
    return new Date(base.getTime() + 5 * 60 * 1000);
  }

  private normalizeConnectionState(state: string | null | undefined): string {
    const s = (state || '').trim().toLowerCase();
    if (!s) return 'pending';
    if (s.includes('open') || s.includes('connected')) return 'open';
    if (s.includes('connect')) return 'connecting';
    if (s.includes('close') || s.includes('disconnect')) return 'close';
    if (s.includes('qr')) return 'qr_ready';
    return s;
  }

  private extractDisplayLineId(data: JsonRecord | null): string | null {
    if (!data) return null;
    const nestedUser = asRecord(data['user']);
    const nestedUserUpper = asRecord(data['User']);
    const nestedOwner = asRecord(data['owner']);
    const nestedOwnerUpper = asRecord(data['Owner']);
    const candidates = [
      data['number'],
      data['Number'],
      data['phone'],
      data['Phone'],
      data['wid'],
      data['Wid'],
      data['pn'],
      data['Pn'],
      nestedUser?.['id'],
      nestedUser?.['wid'],
      nestedUserUpper?.['id'],
      nestedUserUpper?.['wid'],
      nestedOwner?.['id'],
      nestedOwner?.['wid'],
      nestedOwnerUpper?.['id'],
      nestedOwnerUpper?.['wid'],
    ];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      const digits = trimmed.includes('@')
        ? trimmed.split('@')[0]?.replace(/\D/g, '') || ''
        : trimmed.replace(/\s+/g, '');
      return digits || trimmed;
    }
    return null;
  }

  private readConnectionStateFromPayload(data: JsonRecord | null): string | null {
    if (!data) return null;
    const nestedInstance = asRecord(data['instance']);
    const nestedInstanceUpper = asRecord(data['Instance']);
    const candidates = [
      data['state'],
      data['State'],
      data['status'],
      data['Status'],
      data['connection'],
      data['Connection'],
      data['connectionStatus'],
      data['ConnectionStatus'],
      nestedInstance?.['state'],
      nestedInstance?.['status'],
      nestedInstance?.['connectionStatus'],
      nestedInstanceUpper?.['state'],
      nestedInstanceUpper?.['status'],
      nestedInstanceUpper?.['connectionStatus'],
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
    return null;
  }

  private serializeInstance(instance: WhatsappInstanceRow | null) {
    if (!instance) return null;
    return {
      id: instance.id,
      instanceName: instance.instanceName,
      evoInstanceId: instance.evoInstanceId,
      displayLineId: instance.displayLineId,
      status: instance.status,
      isConnected: instance.status === 'open',
      qrCode: instance.qrCode,
      qrText: instance.qrText,
      pairingCode: instance.pairingCode,
      qrGeneratedAt: instance.qrGeneratedAt?.toISOString() ?? null,
      qrExpiresAt: instance.qrExpiresAt?.toISOString() ?? null,
      lastConnectedAt: instance.lastConnectedAt?.toISOString() ?? null,
      lastDisconnectedAt: instance.lastDisconnectedAt?.toISOString() ?? null,
      lastError: instance.lastError,
      createdAt: instance.createdAt.toISOString(),
      updatedAt: instance.updatedAt.toISOString(),
    };
  }

  private async findUserInstance(userId: string): Promise<WhatsappInstanceRow | null> {
    return this.prisma.whatsappInstance.findUnique({
      where: { userId },
      select: WHATSAPP_INSTANCE_SELECT,
    }) as Promise<WhatsappInstanceRow | null>;
  }

  private async findInstanceByEvent(args: {
    instanceId?: string | null;
    instanceName?: string | null;
    instanceToken?: string | null;
  }): Promise<WhatsappInstanceRow | null> {
    const or: Prisma.WhatsappInstanceWhereInput[] = [];
    if (args.instanceId?.trim()) {
      or.push({ evoInstanceId: args.instanceId.trim() });
    }
    if (args.instanceName?.trim()) {
      or.push({ instanceName: args.instanceName.trim() });
    }
    if (args.instanceToken?.trim()) {
      or.push({ instanceApiKey: args.instanceToken.trim() });
    }
    if (or.length === 0) return null;
    return this.prisma.whatsappInstance.findFirst({
      where: { OR: or },
      select: WHATSAPP_INSTANCE_SELECT,
    }) as Promise<WhatsappInstanceRow | null>;
  }

  private async updateInstance(
    id: string,
    data: Prisma.WhatsappInstanceUpdateInput,
  ): Promise<WhatsappInstanceRow> {
    return this.prisma.whatsappInstance.update({
      where: { id },
      data,
      select: WHATSAPP_INSTANCE_SELECT,
    }) as Promise<WhatsappInstanceRow>;
  }

  private shouldRecreateInstance(message: string | null | undefined): boolean {
    const normalized = (message || '').trim().toLowerCase();
    if (!normalized) return false;
    return (
      normalized.includes('not authorized') ||
      normalized.includes('unauthorized') ||
      normalized.includes('forbidden') ||
      normalized.includes('token') ||
      normalized.includes('apikey')
    );
  }

  private async recreateUserInstance(
    instance: WhatsappInstanceRow,
    userName: string,
  ): Promise<WhatsappInstanceRow> {
    const slug = await this.preferredInstanceSlug(instance.userId, userName);
    const created = await this.evogo.createInstance({
      instanceName: this.buildInstanceName(slug, instance.userId),
      webhook: {
        url: this.webhookUrl(),
      },
    });
    const now = new Date();
    const hasQr = Boolean(created.qrCode || created.qrText || created.pairingCode);
    return this.updateInstance(instance.id, {
      instanceName: created.instanceName,
      instanceApiKey: created.instanceApiKey,
      evoInstanceId: created.instanceId,
      displayLineId: null,
      status: hasQr ? 'qr_ready' : this.normalizeConnectionState(created.status),
      qrCode: created.qrCode,
      qrText: created.qrText,
      pairingCode: created.pairingCode,
      qrGeneratedAt: hasQr ? now : null,
      qrExpiresAt: hasQr ? this.qrExpiryDate(now) : null,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastError: null,
    });
  }

  private async syncConnectionState(
    instance: WhatsappInstanceRow,
    swallowErrors = false,
  ): Promise<WhatsappInstanceRow> {
    try {
      const remote = await this.evogo.connectionState({
        instanceName: instance.instanceName,
        instanceApiKey: instance.instanceApiKey,
      });
      const normalized = this.normalizeConnectionState(remote.state);
      const now = new Date();
      return this.updateInstance(instance.id, {
        status: normalized,
        lastError: null,
        ...(normalized === 'open'
          ? {
              qrCode: null,
              qrText: null,
              pairingCode: null,
              qrGeneratedAt: null,
              qrExpiresAt: null,
              lastConnectedAt: now,
            }
          : {}),
        ...(normalized === 'close' ? { lastDisconnectedAt: now } : {}),
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'No se pudo consultar el estado de WhatsApp';
      if (swallowErrors) {
        return this.updateInstance(instance.id, { lastError: message });
      }
      throw new ServiceUnavailableException(message);
    }
  }

  private async ensureUserInstance(
    userId: string,
    userName: string,
  ): Promise<WhatsappInstanceRow> {
    const existing = await this.findUserInstance(userId);
    if (existing) return existing;
    const slug = await this.preferredInstanceSlug(userId, userName);
    const created = await this.evogo.createInstance({
      instanceName: this.buildInstanceName(slug, userId),
      webhook: {
        url: this.webhookUrl(),
      },
    });
    const now = new Date();
    return this.prisma.whatsappInstance.create({
      data: {
        userId,
        instanceName: created.instanceName,
        instanceApiKey: created.instanceApiKey,
        evoInstanceId: created.instanceId,
        displayLineId: null,
        status: created.qrCode || created.qrText || created.pairingCode
          ? 'qr_ready'
          : this.normalizeConnectionState(created.status),
        qrCode: created.qrCode,
        qrText: created.qrText,
        pairingCode: created.pairingCode,
        qrGeneratedAt:
          created.qrCode || created.qrText || created.pairingCode ? now : null,
        qrExpiresAt:
          created.qrCode || created.qrText || created.pairingCode
            ? this.qrExpiryDate(now)
            : null,
        lastError: null,
      },
      select: WHATSAPP_INSTANCE_SELECT,
    }) as Promise<WhatsappInstanceRow>;
  }

  async getMyConnection(userId: string) {
    const current = await this.findUserInstance(userId);
    const synced = current ? await this.syncConnectionState(current, true) : null;
    return {
      canManage: this.personalConnectionsEnabled(),
      instance: this.serializeInstance(synced),
    };
  }

  async connectMyWhatsapp(userId: string, userName: string) {
    let existing = await this.findUserInstance(userId);
    if (!existing && !this.personalConnectionsEnabled()) {
      throw new ServiceUnavailableException(
        'Faltan EVOGO_MANAGER_API_KEY o EVOGO_WEBHOOK_URL para conectar tu WhatsApp personal',
      );
    }
    let instance = existing || (await this.ensureUserInstance(userId, userName));
    instance = await this.syncConnectionState(instance, true);
    if (this.shouldRecreateInstance(instance.lastError) && this.personalConnectionsEnabled()) {
      this.logger.warn(
        `Recreando instancia personal de WhatsApp para userId=${userId} por credenciales invalidas en Evolution GO`,
      );
      instance = await this.recreateUserInstance(instance, userName);
    }
    if (instance.status === 'open') {
      return {
        canManage: true,
        instance: this.serializeInstance(instance),
      };
    }
    let qr;
    try {
      qr = await this.evogo.connectInstance({
        instanceName: instance.instanceName,
        instanceApiKey: instance.instanceApiKey,
        webhookUrl: this.webhookUrl(),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo generar el QR';
      if (this.shouldRecreateInstance(message) && this.personalConnectionsEnabled()) {
        this.logger.warn(
          `Reintentando con una nueva instancia de WhatsApp para userId=${userId} tras error de autorizacion`,
        );
        instance = await this.recreateUserInstance(instance, userName);
        qr = await this.evogo.connectInstance({
          instanceName: instance.instanceName,
          instanceApiKey: instance.instanceApiKey,
          webhookUrl: this.webhookUrl(),
        });
      } else {
        throw e;
      }
    }
    const now = new Date();
    const hasQr = Boolean(qr.qrCode || qr.qrText);
    instance = await this.updateInstance(instance.id, {
      status: hasQr ? 'qr_ready' : 'pending',
      qrCode: qr.qrCode ?? null,
      qrText: qr.qrText ?? null,
      pairingCode: qr.pairingCode,
      qrGeneratedAt: hasQr ? now : null,
      qrExpiresAt: hasQr ? this.qrExpiryDate(now) : null,
      lastError: hasQr
        ? null
        : 'Evolution Go no devolvio el QR todavia. Intenta regenerarlo nuevamente en unos segundos.',
    });
    if (!hasQr) {
      throw new ServiceUnavailableException(
        'La instancia se creo correctamente, pero Evolution Go todavia no devolvio el QR. Intenta regenerarlo nuevamente en unos segundos.',
      );
    }
    return {
      canManage: true,
      instance: this.serializeInstance(instance),
    };
  }

  async refreshMyConnection(userId: string) {
    const instance = await this.findUserInstance(userId);
    if (!instance) {
      return {
        canManage: this.personalConnectionsEnabled(),
        instance: null,
      };
    }
    const synced = await this.syncConnectionState(instance, true);
    return {
      canManage: this.personalConnectionsEnabled(),
      instance: this.serializeInstance(synced),
    };
  }

  async disconnectMyWhatsapp(userId: string) {
    const instance = await this.findUserInstance(userId);
    if (!instance) {
      return {
        canManage: this.personalConnectionsEnabled(),
        instance: null,
      };
    }
    try {
      await this.evogo.logoutInstance({
        instanceName: instance.instanceName,
        instanceApiKey: instance.instanceApiKey,
      });
    } catch (e) {
      throw new ServiceUnavailableException(
        e instanceof Error ? e.message : 'No se pudo desconectar la instancia',
      );
    }
    const now = new Date();
    const updated = await this.updateInstance(instance.id, {
      status: 'close',
      qrCode: null,
      qrText: null,
      pairingCode: null,
      qrGeneratedAt: null,
      qrExpiresAt: null,
      lastDisconnectedAt: now,
      lastError: null,
    });
    return {
      canManage: this.personalConnectionsEnabled(),
      instance: this.serializeInstance(updated),
    };
  }

  private async resolveSenderConfig(
    userId: string,
    overrideInstanceApiKey?: string | null,
  ): Promise<{
    instanceApiKey: string;
    evoInstanceId: string;
    evoInstanceName: string | null;
    displayLineId: string;
    whatsappInstanceId: string | null;
  }> {
    const override = overrideInstanceApiKey?.trim();
    const personal = await this.findUserInstance(userId);
    if (personal && (!override || override === personal.instanceApiKey)) {
      return {
        instanceApiKey: personal.instanceApiKey,
        evoInstanceId: personal.evoInstanceId || personal.instanceName,
        evoInstanceName: personal.instanceName,
        displayLineId: personal.displayLineId || personal.instanceName,
        whatsappInstanceId: personal.id,
      };
    }
    return {
      instanceApiKey: override || this.defaultInstanceKey(),
      evoInstanceId: this.defaultInstanceId(),
      evoInstanceName: this.defaultInstanceName(),
      displayLineId: this.displaySenderId(),
      whatsappInstanceId: null,
    };
  }

  private rankOutboundStatus(s: string | null | undefined): number {
    const rank: Record<string, number> = { sent: 0, delivered: 1, read: 2 };
    return typeof s === 'string' && s in rank ? rank[s]! : -1;
  }

  private shouldUpgradeOutboundStatus(
    current: string | null | undefined,
    next: 'delivered' | 'read',
  ): boolean {
    return this.rankOutboundStatus(next) > this.rankOutboundStatus(current);
  }

  private async applyOutboundReceipts(
    evoInstanceId: string,
    messageIds: string[],
    next: 'delivered' | 'read',
  ): Promise<void> {
    const unique = [...new Set(messageIds.filter(Boolean))];
    if (unique.length === 0) return;

    for (const waMessageId of unique) {
      const rows = await this.prisma.crmWhatsappMessage.findMany({
        where: {
          evoInstanceId,
          waMessageId,
          direction: 'outbound',
        },
        select: {
          id: true,
          contactId: true,
          waOutboundStatus: true,
        },
      });
      for (const row of rows) {
        if (!row.contactId) continue;
        if (!this.shouldUpgradeOutboundStatus(row.waOutboundStatus, next)) {
          continue;
        }
        await this.prisma.crmWhatsappMessage.update({
          where: { id: row.id },
          data: { waOutboundStatus: next },
        });
        this.gateway.emitToContact(row.contactId, {
          type: 'status',
          contactId: row.contactId,
          id: row.id,
          waOutboundStatus: next,
        });
      }
    }
  }

  private mediaTypeFromMime(mimeType: string): WhatsappMessageAttachmentDto['mediaType'] {
    const mime = mimeType.trim().toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.includes('pdf') || mime.includes('document') || mime.startsWith('application/')) {
      return 'document';
    }
    return 'file';
  }

  private extensionFromMime(mimeType: string | null | undefined): string {
    const mime = (mimeType || '').trim().toLowerCase();
    const known: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'application/pdf': 'pdf',
    };
    if (mime in known) return known[mime]!;
    if (mime.includes('/')) return mime.split('/')[1]!.replace(/[^a-z0-9]+/g, '') || 'bin';
    return 'bin';
  }

  private fallbackMediaFilename(
    mediaType: 'image' | 'video' | 'audio' | 'document',
    mimeType: string | null,
    messageId: string,
  ): string {
    const ext = this.extensionFromMime(mimeType);
    return `whatsapp-${mediaType}-${messageId.slice(0, 8)}.${ext}`;
  }

  private async buildMessageItems(
    rows: WhatsappListItemRow[],
  ): Promise<WhatsappListItemDto[]> {
    if (rows.length === 0) return [];
    const messageIds = rows.map((row) => row.id);
    const files = await this.prisma.crmFile.findMany({
      where: {
        relatedEntityType: 'whatsapp-message',
        relatedEntityId: { in: messageIds },
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        relatedEntityId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const attachmentsByMessage = new Map<string, WhatsappMessageAttachmentDto[]>();
    await Promise.all(
      files.map(async (file) => {
        let url: string | null = null;
        try {
          url = (await this.files.presignGet(file.id, 'inline')).url;
        } catch (e) {
          this.logger.warn(`No se pudo resolver URL de adjunto WhatsApp ${file.id}: ${String(e)}`);
        }
        const attachment: WhatsappMessageAttachmentDto = {
          id: file.id,
          name: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          mediaType: this.mediaTypeFromMime(file.mimeType),
          url,
        };
        const list = attachmentsByMessage.get(file.relatedEntityId || '') ?? [];
        list.push(attachment);
        attachmentsByMessage.set(file.relatedEntityId || '', list);
      }),
    );
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      attachments: attachmentsByMessage.get(row.id) ?? [],
    }));
  }

  private waNumberCandidates(rawPhone: string): string[] {
    const digits = digitsOnly(rawPhone);
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

  private async persistInboundMediaAttachment(args: {
    messageId: string;
    contact:
      | {
          id: string;
          name: string;
          telefono: string | null;
          assignedTo: string | null;
        }
      | null;
    instance: WhatsappInstanceRow | null;
    media: NonNullable<ReturnType<typeof parseMessageMedia>>;
  }): Promise<void> {
    const { messageId, contact, instance, media } = args;
    if (!contact?.id) return;
    const uploadedById = contact.assignedTo || instance?.userId;
    if (!uploadedById) {
      this.logger.warn(`Adjunto WhatsApp ${messageId} omitido: no hay usuario dueño para CrmFile`);
      return;
    }
    if (!media.url) {
      this.logger.warn(`Adjunto WhatsApp ${messageId} omitido: Evolution no devolvio URL de descarga`);
      return;
    }
    try {
      const res = await fetch(media.url);
      if (!res.ok) {
        throw new Error(`download HTTP ${res.status}`);
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0) {
        throw new Error('download vacio');
      }
      const originalName =
        media.fileName?.trim() ||
        this.fallbackMediaFilename(media.mediaType, media.mimeType, messageId);
      await this.files.create(uploadedById, {
        buffer: bytes,
        originalName,
        mimeType: media.mimeType || 'application/octet-stream',
        entityType: 'contact',
        entityId: contact.id,
        entityName: contact.name,
        relatedEntityType: 'whatsapp-message',
        relatedEntityId: messageId,
        relatedEntityName: `whatsapp-${media.mediaType}`,
      });
    } catch (e) {
      this.logger.warn(
        `No se pudo almacenar adjunto WhatsApp ${messageId} en crm-adjuntos: ${String(e)}`,
      );
    }
  }

  private async emitListItemById(contactId: string, messageId: string) {
    const row = await this.prisma.crmWhatsappMessage.findUnique({
      where: { id: messageId },
      select: WHATSAPP_LIST_SELECT,
    });
    if (!row) return;
    const [item] = await this.buildMessageItems([row as WhatsappListItemRow]);
    if (!item) return;
    this.gateway.emitToContact(contactId, {
      type: 'message',
      contactId,
      item: item as unknown as Record<string, unknown>,
    });
  }

  async sendFromCrm(dto: SendWhatsappDto, scope: CrmDataScope, userId: string) {
    const sender = await this.resolveSenderConfig(userId, dto.instanceApiKey);
    const contact = await this.contactsService.findOne(dto.contactId, scope);
    const to = normalizePeWaNumber(contact.telefono);
    if (to.length < 8) {
      throw new ServiceUnavailableException(
        'El contacto no tiene un teléfono válido para WhatsApp',
      );
    }

    const sent = await this.evogo.sendText({
      instanceApiKey: sender.instanceApiKey,
      number: to,
      text: dto.text.trim(),
    });

    if (!sent.ok) {
      const msg =
        typeof sent.raw === 'object' &&
        sent.raw !== null &&
        'error' in sent.raw
          ? String((sent.raw as { error?: unknown }).error)
          : `Evolution GO respondió ${sent.status}`;
      throw new ServiceUnavailableException(
        `No se pudo enviar el mensaje: ${msg}`,
      );
    }

    const row = await this.prisma.crmWhatsappMessage.create({
      data: {
        direction: 'outbound',
        evoInstanceId: sender.evoInstanceId,
        evoInstanceName: sender.evoInstanceName,
        waMessageId: sent.waMessageId ?? null,
        fromWaId: sender.displayLineId,
        toWaId: to,
        body: dto.text.trim(),
        payloadJson: stripHeavyPayload(sent.raw) as Prisma.InputJsonValue,
        contactId: contact.id,
        whatsappInstanceId: sender.whatsappInstanceId,
        createdByUserId: userId,
        waOutboundStatus: 'sent',
      },
    });

    await this.emitListItemById(contact.id, row.id);

    return {
      id: row.id,
      direction: row.direction,
      toWaId: row.toWaId,
      waMessageId: row.waMessageId,
      waOutboundStatus: row.waOutboundStatus,
    };
  }

  async listForContact(contactId: string, scope: CrmDataScope, limit = 50) {
    const contact = await this.contactsService.findOne(contactId, scope);
    const take = Math.min(200, Math.max(1, limit));
    const phoneCandidates = this.waNumberCandidates(contact.telefono || '');
    const where: Prisma.CrmWhatsappMessageWhereInput =
      phoneCandidates.length > 0
        ? {
            OR: [
              { contactId },
              {
                contactId: null,
                direction: 'inbound',
                fromWaId: { in: phoneCandidates },
              },
              {
                contactId: null,
                direction: 'outbound',
                toWaId: { in: phoneCandidates },
              },
            ],
          }
        : { contactId };
    const rows = await this.prisma.crmWhatsappMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      select: WHATSAPP_LIST_SELECT,
    });
    return {
      items: await this.buildMessageItems(rows.reverse() as WhatsappListItemRow[]),
    };
  }

  /**
   * Webhook público: cuerpo JSON de Evolution GO (event + data + instance*).
   * Query `token` debe coincidir con EVOGO_WEBHOOK_SECRET si está definido.
   */
  async handleEvolutionWebhook(
    queryToken: string | undefined,
    body: unknown,
  ): Promise<{ ok: boolean; ignored?: string }> {
    const secret = this.config.get<string>('EVOGO_WEBHOOK_SECRET')?.trim();
    if (secret && queryToken !== secret) {
      throw new UnauthorizedException('Token de webhook inválido');
    }

    const base = readEvolutionWebhookEvent(body);
    if (!base) {
      return { ok: true, ignored: 'not_json_event' };
    }

    const evLower = base.event.toLowerCase();

    if (
      evLower === 'qrcode_updated' ||
      evLower === 'qrcode.updated'
    ) {
      const instance = await this.findInstanceByEvent(base);
      if (!instance) {
        return { ok: true, ignored: 'qr_unknown_instance' };
      }
      const data = asRecord(base.data);
      const qrcode =
        asRecord(data?.['qrcode']) ?? asRecord(data?.['Qrcode']) ?? data;
      const qrCode =
        typeof qrcode?.['base64'] === 'string'
          ? qrcode['base64']
          : typeof qrcode?.['Base64'] === 'string'
            ? qrcode['Base64']
            : null;
      const qrText =
        typeof qrcode?.['code'] === 'string'
          ? qrcode['code']
          : typeof qrcode?.['Code'] === 'string'
            ? qrcode['Code']
            : null;
      const pairingCode =
        typeof qrcode?.['pairingCode'] === 'string'
          ? qrcode['pairingCode']
          : typeof qrcode?.['PairingCode'] === 'string'
            ? qrcode['PairingCode']
          : null;
      const now = new Date();
      await this.updateInstance(instance.id, {
        status: 'qr_ready',
        evoInstanceId: base.instanceId || instance.evoInstanceId,
        qrCode,
        qrText,
        pairingCode,
        qrGeneratedAt: now,
        qrExpiresAt: this.qrExpiryDate(now),
        lastError: null,
      });
      return { ok: true };
    }

    if (
      evLower === 'connection_update' ||
      evLower === 'connection.update'
    ) {
      const instance = await this.findInstanceByEvent(base);
      if (!instance) {
        return { ok: true, ignored: 'connection_unknown_instance' };
      }
      const data = asRecord(base.data);
      const nextStatus = this.normalizeConnectionState(
        this.readConnectionStateFromPayload(data),
      );
      const now = new Date();
      await this.updateInstance(instance.id, {
        status: nextStatus,
        evoInstanceId: base.instanceId || instance.evoInstanceId,
        displayLineId:
          this.extractDisplayLineId(data) || instance.displayLineId,
        lastError: null,
        ...(nextStatus === 'open'
          ? {
              qrCode: null,
              qrText: null,
              pairingCode: null,
              qrGeneratedAt: null,
              qrExpiresAt: null,
              lastConnectedAt: now,
            }
          : {}),
        ...(nextStatus === 'close' ? { lastDisconnectedAt: now } : {}),
      });
      return { ok: true };
    }

    if (base.event === 'Message') {
      const parsed = readMessageEventPayload(body);
      if (!parsed) {
        return { ok: true, ignored: 'not_json_event' };
      }
      return this.handleMessageWebhook(parsed);
    }

    if (base.event === 'Receipt') {
      const data = asRecord(base.data);
      if (!data) {
        return { ok: true, ignored: 'receipt_no_data' };
      }
      const { messageIds, outboundStatus } = parseReceiptEventData(data);
      if (!outboundStatus || messageIds.length === 0) {
        return { ok: true, ignored: 'receipt_empty' };
      }
      await this.applyOutboundReceipts(
        base.instanceId || 'unknown',
        messageIds,
        outboundStatus,
      );
      return { ok: true };
    }

    if (
      evLower === 'messages_update' ||
      evLower === 'messages.update' ||
      base.event === 'MESSAGES_UPDATE'
    ) {
      const raw = base.data;
      const chunks: JsonRecord[] = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const rec = asRecord(item);
          if (rec) chunks.push(rec);
        }
      } else {
        const rec = asRecord(raw);
        if (rec) chunks.push(rec);
      }
      for (const data of chunks) {
        const u = parseMessagesUpdateEventData(data);
        if (!u.fromMe || !u.waMessageId || !u.outboundStatus) {
          continue;
        }
        await this.applyOutboundReceipts(
          base.instanceId || 'unknown',
          [u.waMessageId],
          u.outboundStatus,
        );
      }
      return { ok: true };
    }

    return { ok: true, ignored: `event:${base.event}` };
  }

  private async handleMessageWebhook(
    parsed: NonNullable<ReturnType<typeof readMessageEventPayload>>,
  ): Promise<{ ok: boolean; ignored?: string }> {
    const msg = parseMessageEventData(parsed.data);
    const media = parseMessageMedia(parsed.data);

    if (msg.isGroup) {
      return { ok: true, ignored: 'group' };
    }

    if (msg.isFromMe) {
      return { ok: true, ignored: 'from_me' };
    }

    const peerDigits = msg.senderDigits || msg.chatDigits;
    if (!peerDigits || peerDigits.length < 8) {
      return { ok: true, ignored: 'no_peer' };
    }

    if (msg.waMessageId) {
      const dup = await this.prisma.crmWhatsappMessage.findFirst({
        where: {
          evoInstanceId: parsed.instanceId,
          waMessageId: msg.waMessageId,
          direction: 'inbound',
        },
      });
      if (dup) {
        return { ok: true, ignored: 'duplicate' };
      }
    }

    const contact = await this.findContactByLoosePhone(peerDigits);
    const instance = await this.findInstanceByEvent(parsed);
    const ourLine =
      instance?.displayLineId || parsed.instanceName || this.displaySenderId();

    const textBody = msg.text.trim() || '[Sin texto]';

    const created = await this.prisma.crmWhatsappMessage.create({
      data: {
        direction: 'inbound',
        evoInstanceId: parsed.instanceId || 'unknown',
        evoInstanceName: parsed.instanceName,
        waMessageId: msg.waMessageId,
        fromWaId: peerDigits,
        toWaId: ourLine,
        body: textBody,
        payloadJson: stripHeavyPayload(parsed.data) as Prisma.InputJsonValue,
        contactId: contact?.id ?? null,
        whatsappInstanceId: instance?.id ?? null,
      },
    });

    if (media) {
      await this.persistInboundMediaAttachment({
        messageId: created.id,
        contact,
        instance,
        media,
      });
    }

    if (contact?.id) {
      await this.emitListItemById(contact.id, created.id);
    }

    if (contact?.assignedTo) {
      try {
        await this.notifications.notifyWhatsappInbound({
          userId: contact.assignedTo,
          contactId: contact.id,
          contactName: contact.name,
          preview: textBody.slice(0, 500),
          evoInstanceName: parsed.instanceName,
          waMessageId: msg.waMessageId,
          evoInstanceId: parsed.instanceId || 'unknown',
        });
      } catch (e) {
        this.logger.warn(`notifyWhatsappInbound: ${String(e)}`);
      }
    }

    return { ok: true };
  }

  private async findContactByLoosePhone(peerDigits: string) {
    const candidates = this.waNumberCandidates(peerDigits);
    if (candidates.length === 0) return null;
    const rows = await this.prisma.$queryRaw<LooseContactMatchRow[]>`
      SELECT
        id,
        name,
        telefono,
        "assignedTo"
      FROM "Contact"
      WHERE telefono IS NOT NULL
        AND regexp_replace(telefono, '\D', '', 'g') = ANY(${candidates}::text[])
      ORDER BY
        CASE
          WHEN regexp_replace(telefono, '\D', '', 'g') = ${candidates[0]} THEN 0
          ELSE 1
        END,
        "updatedAt" DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  }
}
