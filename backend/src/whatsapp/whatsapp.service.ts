import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
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
import { S3StorageService } from '../files/s3-storage.service';
import { EvogoClient, type EvogoSendTextResult } from './evogo.client';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import { digitsOnly, normalizePeWaNumber } from './wa-number.util';
import {
  parseMessageEventData,
  parseMessageMedia,
  parseMessagesUpdateEventData,
  parseReceiptEventData,
  readEvolutionWebhookEvent,
  readMessageEventPayload,
  resolveEvolutionMediaUrl,
  stripHeavyPayload,
} from './evolution-webhook.util';
import { WhatsappGateway } from './whatsapp.gateway';
import { spawn } from 'child_process';
import { randomUUID } from 'node:crypto';
import XLSX from 'xlsx';

type JsonRecord = Record<string, unknown>;
type WhatsappMessageAttachmentDto = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'file';
  url: string | null;
  downloadUrl: string | null;
  proxyUrl: string | null;
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
  payloadJson: Prisma.JsonValue | null;
};
type WhatsappListItemDto = Omit<WhatsappListItemRow, 'createdAt' | 'payloadJson'> & {
  createdAt: string;
  attachments: WhatsappMessageAttachmentDto[];
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
  useForInbox: boolean;
  useForMasivo: boolean;
  createdAt: Date;
  updatedAt: Date;
};


type FlotaProspectoMediaRef = { id: string; nombreCompleto: string };

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
  payloadJson: true,
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
  useForInbox: true,
  useForMasivo: true,
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
    private readonly s3: S3StorageService,
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
      useForInbox: instance.useForInbox,
      useForMasivo: instance.useForMasivo,
      createdAt: instance.createdAt.toISOString(),
      updatedAt: instance.updatedAt.toISOString(),
    };
  }

  private async findUserInstance(userId: string): Promise<WhatsappInstanceRow | null> {
    return this.prisma.whatsappInstance.findFirst({
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
      normalized.includes('not found') ||
      normalized.includes('404') ||
      normalized.includes('does not exist') ||
      normalized.includes('page not found') ||
      normalized.includes('instance not found') ||
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
      let normalized = this.normalizeConnectionState(remote.state);
      const hasQr = Boolean(instance.qrCode || instance.qrText || instance.pairingCode);
      if (normalized === 'close' && hasQr) {
        normalized = 'qr_ready';
      }
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

  async sendMyTestMessage(
    userId: string,
    dto: { number: string; text: string },
  ): Promise<{ ok: true; to: string; waMessageId: string | null }> {
    const current = await this.findUserInstance(userId);
    if (!current) {
      throw new ServiceUnavailableException(
        'Primero conecta tu WhatsApp personal para enviar un mensaje de prueba',
      );
    }

    const instance = await this.syncConnectionState(current, true);
    if (instance.status !== 'open') {
      throw new ServiceUnavailableException(
        'Tu WhatsApp personal aún no está conectado. Escanea el QR antes de enviar una prueba.',
      );
    }

    const to = normalizePeWaNumber(dto.number);
    if (to.length < 8) {
      throw new ServiceUnavailableException(
        'Ingresa un número de WhatsApp válido con código de país, sin signos ni espacios',
      );
    }

    const text = dto.text.trim();
    if (!text) {
      throw new ServiceUnavailableException('El mensaje de prueba no puede estar vacío');
    }

    const sent = await this.evogo.sendText({
      instanceApiKey: instance.instanceApiKey,
      number: to,
      text,
    });

    if (!sent.ok) {
      const msg =
        typeof sent.raw === 'object' &&
        sent.raw !== null &&
        'error' in sent.raw
          ? String((sent.raw as { error?: unknown }).error)
          : `Evolution GO respondió ${sent.status}`;
      throw new ServiceUnavailableException(
        `No se pudo enviar el mensaje de prueba: ${msg}`,
      );
    }

    return {
      ok: true,
      to,
      waMessageId: sent.waMessageId ?? null,
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

    // Si el usuario tiene instancia personal (comercial) conectada, usarla
    if (personal && personal.status === 'open' && (!override || override === personal.instanceApiKey)) {
      return {
        instanceApiKey: personal.instanceApiKey,
        evoInstanceId: personal.evoInstanceId || personal.instanceName,
        evoInstanceName: personal.instanceName,
        displayLineId: personal.displayLineId || personal.instanceName,
        whatsappInstanceId: personal.id,
      };
    }

    // Si la instancia compartida de flota está conectada, usarla (cubre envíos desde inbox/masivo)
    const shared = await this.findSharedInstance();
    if (shared && shared.status === 'open') {
      return {
        instanceApiKey: shared.instanceApiKey,
        evoInstanceId: shared.evoInstanceId || this.defaultInstanceId(),
        evoInstanceName: shared.instanceName,
        displayLineId: shared.instanceName,
        whatsappInstanceId: shared.id,
      };
    }

    // Fallback al default global (env vars)
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
          flotaProspectoId: true,
          waOutboundStatus: true,
        },
      });
      for (const row of rows) {
        if (!row.contactId && !row.flotaProspectoId) continue;
        if (!this.shouldUpgradeOutboundStatus(row.waOutboundStatus, next)) {
          continue;
        }
        await this.prisma.crmWhatsappMessage.update({
          where: { id: row.id },
          data: { waOutboundStatus: next },
        });
        if (row.contactId) {
          this.gateway.emitToContact(row.contactId, {
            type: 'status',
            contactId: row.contactId,
            id: row.id,
            waOutboundStatus: next,
          });
        }
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
    const baseMime = mime.includes(';') ? mime.split(';')[0]!.trim() : mime.includes(' ') ? mime.split(' ')[0]!.trim() : mime;
    if (baseMime in known) return known[baseMime]!;
    if (baseMime.includes('/')) return baseMime.split('/')[1]!.replace(/[^a-z0-9]+/g, '') || 'bin';
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

  private evolutionBaseUrl(): string | null {
    const raw = this.config.get<string>('EVOGO_BASE_URL')?.trim();
    return raw ? raw.replace(/\/$/, '') : null;
  }

  private decodeWhatsappMediaBase64(base64: string | null | undefined): Buffer | null {
    if (!base64?.trim()) return null;
    const trimmed = base64.trim();
    const raw = trimmed.startsWith('data:')
      ? trimmed.slice(trimmed.indexOf(',') + 1)
      : trimmed;
    if (!raw) return null;
    try {
      const buffer = Buffer.from(raw, 'base64');
      return buffer.length > 0 ? buffer : null;
    } catch {
      return null;
    }
  }

  private async downloadWhatsappMedia(url: string): Promise<Buffer> {
    const res = await fetch(url, {
      headers: {
        Accept: '*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; monterrico-sales/1.0)',
      },
    });
    if (!res.ok) {
      throw new Error(`download HTTP ${res.status}`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) {
      throw new Error('download vacio');
    }
    return bytes;
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
        let downloadUrl: string | null = null;
        try {
          url = (await this.files.presignGet(file.id, 'inline')).url;
        } catch (e) {
          this.logger.warn(`No se pudo resolver URL de adjunto WhatsApp ${file.id}: ${String(e)}`);
        }
        try {
          downloadUrl = (await this.files.presignGet(file.id, 'attachment')).url;
        } catch (e) {
          this.logger.warn(
            `No se pudo resolver URL de descarga de adjunto WhatsApp ${file.id}: ${String(e)}`,
          );
        }
        const attachment: WhatsappMessageAttachmentDto = {
          id: file.id,
          name: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          mediaType: this.mediaTypeFromMime(file.mimeType),
          url,
          downloadUrl,
          proxyUrl: null,
        };
        const list = attachmentsByMessage.get(file.relatedEntityId || '') ?? [];
        list.push(attachment);
        attachmentsByMessage.set(file.relatedEntityId || '', list);
      }),
    );
    return rows.map((row) => {
      const stored = attachmentsByMessage.get(row.id) ?? [];
      if (stored.length > 0) {
        return {
          ...row,
          createdAt: row.createdAt.toISOString(),
          attachments: stored,
        };
      }
      const payload = asRecord(row.payloadJson);
      const fallbackMedia = payload ? parseMessageMedia(payload) : null;
      const fallbackUrl = resolveEvolutionMediaUrl(
        fallbackMedia?.url,
        this.evolutionBaseUrl(),
      );
      const proxyUrl = `/api/whatsapp/media/proxy/${row.id}`;
      const mediaType = fallbackMedia?.mediaType;
      const useProxy = mediaType === 'image' || mediaType === 'video' || mediaType === 'audio' || mediaType === 'document';
      const fallbackAttachments: WhatsappMessageAttachmentDto[] =
        fallbackMedia && fallbackUrl
          ? [
              {
                id: `payload:${row.id}`,
                name:
                  fallbackMedia.fileName?.trim() ||
                  this.fallbackMediaFilename(
                    fallbackMedia.mediaType,
                    fallbackMedia.mimeType,
                    row.id,
                  ),
                mimeType:
                  fallbackMedia.mimeType || 'application/octet-stream',
                size: fallbackMedia.size ?? 0,
                mediaType: fallbackMedia.mediaType,
                url: fallbackUrl,
                downloadUrl: fallbackUrl,
                proxyUrl: useProxy ? proxyUrl : null,
              },
            ]
          : [];
      return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        attachments: fallbackAttachments,
      };
    });
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
    flotaProspecto?: FlotaProspectoMediaRef | null;
    instance: WhatsappInstanceRow | null;
    media: NonNullable<ReturnType<typeof parseMessageMedia>>;
  }): Promise<void> {
    const { messageId, contact, flotaProspecto, instance, media } = args;
    const entityType = flotaProspecto?.id ? 'flota-prospecto' : 'contact';
    const entityId = flotaProspecto?.id || contact?.id;
    const entityName = flotaProspecto?.nombreCompleto || contact?.name || null;
    if (!entityId) {
      this.logger.warn(`Adjunto WhatsApp ${messageId} omitido: no hay entityId`);
      return;
    }
    let uploadedById = contact?.assignedTo || instance?.userId;
    if (!uploadedById) {
      const admin = await this.prisma.user.findFirst({
        where: { role: { slug: 'admin' } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      uploadedById = admin?.id ?? undefined;
    }
    if (!uploadedById) {
      this.logger.warn(`Adjunto WhatsApp ${messageId} omitido: no hay usuario dueño para CrmFile (instance=${!!instance}, instance.userId=${instance?.userId || 'null'}, contact=${!!contact})`);
      return;
    }
    this.logger.log(`Adjunto WhatsApp ${messageId}: uploadedById=${uploadedById}, entityType=${entityType}, entityId=${entityId}`);
    try {
      const resolvedUrl = resolveEvolutionMediaUrl(
        media.url,
        this.evolutionBaseUrl(),
      );
      let bytes = this.decodeWhatsappMediaBase64(media.base64);
      this.logger.log(`Adjunto WhatsApp ${messageId}: base64=${!!bytes} (len=${media.base64?.length || 0}), url=${!!resolvedUrl}, mediaType=${media.mediaType}`);
      if (!bytes && resolvedUrl) {
        try {
          bytes = await this.downloadWhatsappMedia(resolvedUrl);
          this.logger.log(`Adjunto WhatsApp ${messageId}: descargado por URL, size=${bytes?.length || 0}`);
        } catch (urlError) {
          this.logger.warn(
            `Adjunto WhatsApp ${messageId}: fallo descarga por URL ${resolvedUrl}: ${String(urlError)}`,
          );
          bytes = this.decodeWhatsappMediaBase64(media.base64);
        }
      }
      if (!bytes) {
        this.logger.warn(
          `Adjunto WhatsApp ${messageId} omitido: Evolution no devolvio URL/base64 util para descarga`,
        );
        return;
      }
      const originalName =
        media.fileName?.trim() ||
        this.fallbackMediaFilename(media.mediaType, media.mimeType, messageId);
      await this.files.create(uploadedById, {
        buffer: bytes,
        originalName,
        mimeType: media.mimeType || 'application/octet-stream',
        entityType,
        entityId,
        entityName: entityName ?? undefined,
        relatedEntityType: 'whatsapp-message',
        relatedEntityId: messageId,
        relatedEntityName: `whatsapp-${media.mediaType}`,
      });
      this.logger.log(`Adjunto WhatsApp ${messageId}: guardado OK (${bytes.length} bytes, tipo=${media.mimeType})`);
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
    let flotaProspectoId = dto.flotaProspectoId?.trim() || null;
    let sender: Awaited<ReturnType<typeof this.resolveSenderConfig>>;

    if (flotaProspectoId) {
      const shared = await this.findSharedInstance();
      if (!shared || shared.status !== 'open') {
        throw new ServiceUnavailableException('El WhatsApp compartido de Flota no está conectado.');
      }
      sender = {
        instanceApiKey: shared.instanceApiKey,
        evoInstanceId: shared.evoInstanceId || this.defaultInstanceId(),
        evoInstanceName: this.sharedInstanceName(),
        displayLineId: shared.instanceName,
        whatsappInstanceId: shared.id,
      };
    } else {
      sender = await this.resolveSenderConfig(userId, dto.instanceApiKey);
    }
    // No aplicamos scope aquí: el inbox de WhatsApp permite responder a
    // cualquier contacto que haya iniciado conversación, independientemente
    // de a quién esté asignado en el CRM.
    let contactId = dto.contactId?.trim();
    let contact;

    if (contactId) {
      try {
        contact = await this.contactsService.findOne(contactId);
      } catch {
        contact = null;
      }
    }

    if (!contact) {
      if (!dto.phone) {
        throw new BadRequestException('Falta contactId o phone');
      }
      const digits = dto.phone.replace(/\D/g, '');
      contact = await this.prisma.contact.findFirst({
        where: { telefono: { contains: digits } }
      });
      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            name: dto.name || 'Desconocido',
            telefono: dto.phone,
            correo: '',
            urlSlug: 'wa-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000),
            etapa: 'prospecto',
            fuente: 'flota',
            assignedTo: userId,
          }
        });
      }
      contactId = contact.id;
    }

    if (!flotaProspectoId && dto.phone) {
      const digits = dto.phone.replace(/\D/g, '');
      let prospecto = await this.prisma.flotaProspecto.findFirst({
        where: {
          OR: [
            { celular: { contains: digits } },
            { movil: { contains: digits } },
          ],
        },
        select: { id: true },
      });
      if (!prospecto) {
        prospecto = await this.prisma.flotaProspecto.create({
          data: {
            nombreCompleto: dto.name || dto.phone,
            celular: dto.phone,
            estado: 'Nuevo',
          },
          select: { id: true },
        });
        flotaProspectoId = prospecto.id;
      } else {
        throw new ConflictException(
          `El prospecto con celular ${dto.phone} ya existe (${prospecto.id}). No se envió el mensaje.`,
        );
      }
      const shared = await this.findSharedInstance();
      if (shared && shared.status === 'open') {
        sender = {
          instanceApiKey: shared.instanceApiKey,
          evoInstanceId: shared.evoInstanceId || this.defaultInstanceId(),
          evoInstanceName: this.sharedInstanceName(),
          displayLineId: shared.instanceName,
          whatsappInstanceId: shared.id,
        };
      }
    }

    const to = normalizePeWaNumber(contact.telefono);
    if (to.length < 8) {
      throw new ServiceUnavailableException(
        'El contacto no tiene un teléfono válido para WhatsApp',
      );
    }

    let sent;
    if (dto.imageUrl) {
      sent = await this.evogo.sendMedia({
        instanceApiKey: sender.instanceApiKey,
        number: to,
        mediaUrl: dto.imageUrl,
        mediatype: 'image',
        caption: dto.text.trim() || undefined,
      });
    } else {
      sent = await this.evogo.sendText({
        instanceApiKey: sender.instanceApiKey,
        number: to,
        text: dto.text.trim(),
      });
    }

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
        flotaProspectoId: flotaProspectoId,
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
    await this.contactsService.findOne(contactId);
    const take = Math.min(200, Math.max(1, limit));
    const rows = await this.prisma.crmWhatsappMessage.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      take,
      select: WHATSAPP_LIST_SELECT,
    });
    return {
      items: await this.buildMessageItems(rows.reverse() as WhatsappListItemRow[]),
    };
  }

  async listForFlotaProspecto(prospectoId: string, limit = 50, before?: string) {
    const take = Math.min(200, Math.max(1, limit));
    const where: any = { flotaProspectoId: prospectoId };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }
    const rows = await this.prisma.crmWhatsappMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      select: WHATSAPP_LIST_SELECT,
    });
    const hasMore = rows.length === take;
    return {
      items: await this.buildMessageItems(rows.reverse() as WhatsappListItemRow[]),
      hasMore,
    };
  }

  async downloadMediaFromEvolution(
    messageId: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const message = await this.prisma.crmWhatsappMessage.findUnique({
      where: { id: messageId },
      select: { id: true, evoInstanceName: true, waMessageId: true, payloadJson: true },
    });
    if (!message?.payloadJson) return null;

    const payload = message.payloadJson as JsonRecord;
    const instanceName = message.evoInstanceName ?? this.sharedInstanceName();
    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { instanceName },
      select: { instanceApiKey: true },
    });
    if (!instance?.instanceApiKey) return null;

    const rawPayload = payload as Record<string, unknown>;
    const msgProto: Record<string, unknown> | undefined =
      (rawPayload?.['Message'] as Record<string, unknown>) ??
      (rawPayload?.['message'] as Record<string, unknown>) ??
      ((rawPayload?.['data'] as Record<string, unknown>)?.['Message'] as Record<string, unknown>) ??
      ((rawPayload?.['data'] as Record<string, unknown>)?.['message'] as Record<string, unknown>) ??
      undefined;
    if (!msgProto) return null;

    const buffer = await this.evogo.downloadMedia({
      instanceApiKey: instance.instanceApiKey,
      message: msgProto,
    });
    if (!buffer?.length) return null;

    const media = parseMessageMedia(payload);
    const mimeType = media?.mimeType || 'image/jpeg';

    return { buffer, mimeType };
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

    if (
      base.event === 'Message' ||
      evLower === 'messages_upsert' ||
      evLower === 'messages.upsert' ||
      base.event === 'MESSAGES_UPSERT' ||
      evLower === 'messages_set' ||
      evLower === 'messages.set' ||
      base.event === 'MESSAGES_SET'
    ) {
      const chunks: JsonRecord[] = [];
      if (Array.isArray(base.data)) {
        for (const item of base.data) {
          const rec = asRecord(item);
          if (rec) chunks.push(rec);
        }
      } else {
        const rec = asRecord(base.data);
        if (rec) {
          const nestedMessages = Array.isArray(rec['messages']) ? rec['messages'] : null;
          if (nestedMessages) {
            for (const item of nestedMessages) {
              const msg = asRecord(item);
              if (msg) chunks.push(msg);
            }
          } else {
            chunks.push(rec);
          }
        }
      }
      if (chunks.length === 0) {
        return { ok: true, ignored: 'messages_empty' };
      }
      for (const data of chunks) {
        const parsed = {
          event: base.event,
          instanceId:
            base.instanceId ||
            (typeof data['instanceId'] === 'string' ? data['instanceId'] : '') ||
            'unknown',
          instanceName:
            base.instanceName ||
            (typeof data['instanceName'] === 'string'
              ? data['instanceName']
              : typeof data['instance'] === 'string'
                ? data['instance']
                : null),
          instanceToken: base.instanceToken,
          data,
        };
        await this.handleMessageWebhook(parsed);
      }
      return { ok: true };
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
    if (media) {
      this.logger.log(`Webhook media detectado: type=${media.mediaType}, base64=${!!media.base64} (len=${media.base64?.length || 0}), url=${!!media.url}, mime=${media.mimeType}`);
    } else {
      this.logger.log(`Webhook sin media, body=${msg.text?.slice(0, 100)}`);
    }

    if (msg.isProtocolMessage) {
      return { ok: true, ignored: 'protocol_message' };
    }

    if (msg.isStatusBroadcast) {
      return { ok: true, ignored: 'status_broadcast' };
    }

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

    let flotaProspecto = await this.findFlotaProspectoByPhone(peerDigits);
    if (!flotaProspecto?.id) {
      const normalizedPhone = peerDigits.replace(/\D/g, '').replace(/^51/, '').slice(-9);
      const createdProspecto = await this.prisma.flotaProspecto.create({
        data: {
          nombreCompleto: `Contacto ${normalizedPhone}`,
          celular: normalizedPhone,
          estado: 'Nuevo',
        },
      });
      flotaProspecto = { id: createdProspecto.id, nombreCompleto: createdProspecto.nombreCompleto, celular: createdProspecto.celular };
    }
    const instance = await this.findInstanceByEvent(parsed);
    const instanceToUse = instance ?? (await this.findSharedInstance());
    const ourLine =
      instanceToUse?.displayLineId || parsed.instanceName || this.displaySenderId();

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
        contactId: null,
        flotaProspectoId: flotaProspecto?.id ?? null,
        whatsappInstanceId: instanceToUse?.id ?? null,
      },
    });

    if (flotaProspecto?.id) {
      await this.emitListItemById(flotaProspecto.id, created.id);
    }

    if (media) {
      const prospectoId = flotaProspecto?.id;
      const msgId = created.id;
      this.persistInboundMediaAttachment({
        messageId: created.id,
        contact: null,
        flotaProspecto: flotaProspecto?.id ? flotaProspecto as FlotaProspectoMediaRef : undefined,
        instance: instanceToUse,
        media,
      }).then(async () => {
        if (prospectoId) {
          await this.emitListItemById(prospectoId, msgId);
        }
      }).catch((backgroundErr) => {
        this.logger.warn(`Error background persistInboundMediaAttachment msg=${msgId}: ${String(backgroundErr)}`);
      });
    }

    return { ok: true };
  }

  private async findFlotaProspectoByPhone(peerDigits: string) {
    const candidates = this.waNumberCandidates(peerDigits);
    if (candidates.length === 0) return null;
    const rows = await this.prisma.$queryRaw<{ id: string; nombreCompleto: string; celular: string | null; movil: string | null }[]>`
      SELECT id, "nombreCompleto", celular, movil
      FROM "FlotaProspecto"
      WHERE (celular IS NOT NULL AND regexp_replace(celular, '\D', '', 'g') = ANY(${candidates}::text[]))
         OR (movil IS NOT NULL AND regexp_replace(movil, '\D', '', 'g') = ANY(${candidates}::text[]))
      LIMIT 1
    `;
    if (rows[0]) return { id: rows[0].id, nombreCompleto: rows[0].nombreCompleto, celular: rows[0].celular };
    return null;
  }

  // ─── Instancia compartida de Flota (BD, misma estructura que personales) ───

  private sharedInstanceName(): string {
    return this.config.get<string>('EVOGO_FLOTA_INSTANCE_NAME')?.trim() || 'crm-flota';
  }

  private async findSharedInstance(): Promise<WhatsappInstanceRow | null> {
    return this.prisma.whatsappInstance.findFirst({
      where: { instanceType: 'shared_flota' },
      select: WHATSAPP_INSTANCE_SELECT,
    }) as Promise<WhatsappInstanceRow | null>;
  }

  async getSharedConnection() {
    const current = await this.findSharedInstance();
    const synced = current ? await this.syncConnectionState(current, true) : null;
    return {
      canManage: this.personalConnectionsEnabled(),
      instance: this.serializeInstance(synced),
    };
  }

  async connectSharedWhatsapp() {
    if (!this.personalConnectionsEnabled()) {
      throw new ServiceUnavailableException(
        'Faltan EVOGO_MANAGER_API_KEY o EVOGO_WEBHOOK_URL para conectar el WhatsApp compartido de Flota',
      );
    }

    const name = this.sharedInstanceName();
    const webhookUrl = this.webhookUrl();

    let instance = await this.findSharedInstance();

    if (instance) {
      this.logger.warn(`Instancia "${instance.instanceName}" ya existe, reconectando para regenerar QR...`);
      try {
        const connectResult = await this.evogo.connectInstance({
          instanceName: instance.instanceName,
          instanceApiKey: instance.instanceApiKey,
          webhookUrl,
        });
        const now = new Date();
        const hasQr = Boolean(connectResult.qrCode || connectResult.qrText);
        instance = await this.prisma.whatsappInstance.update({
          where: { id: instance.id },
          data: {
            status: hasQr ? 'qr_ready' : instance.status,
            qrCode: connectResult.qrCode,
            qrText: connectResult.qrText,
            pairingCode: connectResult.pairingCode,
            qrGeneratedAt: hasQr ? now : null,
            qrExpiresAt: hasQr ? this.qrExpiryDate(now) : null,
          },
          select: WHATSAPP_INSTANCE_SELECT,
        }) as WhatsappInstanceRow;
        instance = await this.syncConnectionState(instance, true);
        return {
          canManage: true,
          instance: this.serializeInstance(instance),
        };
      } catch (e) {
        this.logger.warn(`No se pudo reconectar instancia "${name}", se eliminará y creará nueva: ${e instanceof Error ? e.message : e}`);
        await this.prisma.whatsappInstance.delete({ where: { id: instance.id } });
        instance = null;
        try {
          await this.evogo.logoutInstance({ instanceName: name });
        } catch {
          // ignorar
        }
      }
    }

    if (!instance) {
      let created;
      try {
        created = await this.evogo.createInstance({
          instanceName: name,
          webhook: { url: webhookUrl },
        });
      } catch (e) {
        const msg = (e instanceof Error ? e.message : '').toLowerCase();
        if (msg.includes('already exists')) {
          this.logger.warn(`Instancia "${name}" ya existe en Evolution GO, conectando para regenerar QR...`);
          const connectResult = await this.evogo.connectInstance({
            instanceName: name,
            webhookUrl,
          });
          created = {
            instanceName: name,
            instanceId: null,
            instanceApiKey: '',
            status: null,
            qrCode: connectResult.qrCode,
            qrText: connectResult.qrText,
            pairingCode: connectResult.pairingCode,
          };
        } else {
          throw new ServiceUnavailableException(
            e instanceof Error ? e.message : 'Error al crear instancia compartida',
          );
        }
      }
      const now = new Date();
      const hasQr = Boolean(created.qrCode || created.qrText);
      instance = await this.prisma.whatsappInstance.create({
        data: {
          instanceType: 'shared_flota',
          instanceName: created.instanceName,
          instanceApiKey: created.instanceApiKey,
          evoInstanceId: created.instanceId,
          status: hasQr ? 'qr_ready' : this.normalizeConnectionState(created.status),
          qrCode: created.qrCode,
          qrText: created.qrText,
          pairingCode: created.pairingCode,
          qrGeneratedAt: hasQr ? now : null,
          qrExpiresAt: hasQr ? this.qrExpiryDate(now) : null,
        },
        select: WHATSAPP_INSTANCE_SELECT,
      }) as WhatsappInstanceRow;
    }

    instance = await this.syncConnectionState(instance, true);
    if (this.shouldRecreateInstance(instance.lastError) && this.personalConnectionsEnabled()) {
      this.logger.warn('Recreando instancia compartida de WhatsApp por error de autenticación');
      instance = await this.recreateUserInstance({ ...instance, userId: 'flota' }, 'flota');
    }

    if (instance.status === 'open') {
      return { canManage: true, instance: this.serializeInstance(instance) };
    }

    let qr;
    try {
      qr = await this.evogo.connectInstance({
        instanceName: instance.instanceName,
        instanceApiKey: instance.instanceApiKey,
        webhookUrl,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo generar el QR';
      if (this.shouldRecreateInstance(message) && this.personalConnectionsEnabled()) {
        this.logger.warn('Reintentando con nueva instancia compartida tras error de autorización');
        instance = await this.recreateUserInstance({ ...instance, userId: 'flota' }, 'flota');
        qr = await this.evogo.connectInstance({
          instanceName: instance.instanceName,
          instanceApiKey: instance.instanceApiKey,
          webhookUrl,
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
      lastError: hasQr ? null : 'Evolution GO no devolvió el QR todavía. Intenta nuevamente en unos segundos.',
    });

    if (!hasQr) {
      throw new ServiceUnavailableException(
        'La instancia se creó correctamente, pero Evolution GO todavía no devolvió el QR. Intenta nuevamente en unos segundos.',
      );
    }

    return { canManage: true, instance: this.serializeInstance(instance) };
  }

  async disconnectSharedWhatsapp() {
    const instance = await this.findSharedInstance();
    if (!instance) {
      return { canManage: this.personalConnectionsEnabled(), instance: null };
    }
    try {
      await this.evogo.logoutInstance({
        instanceName: instance.instanceName,
        instanceApiKey: instance.instanceApiKey,
      });
    } catch {
      // Si Evolution GO no responde, marcamos como desconectado local
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
    return { canManage: this.personalConnectionsEnabled(), instance: this.serializeInstance(updated) };
  }

  /* ======== Flota multi-instancia ======== */

  async listFlotaInstances() {
    const nodeInstances = await this.prisma.whatsappInstance.findMany({
      where: { instanceType: 'flota_node' },
      select: WHATSAPP_INSTANCE_SELECT,
      orderBy: { createdAt: 'asc' },
    }) as WhatsappInstanceRow[];
    const synced = await Promise.all(
      nodeInstances.map((inst) => this.syncConnectionState(inst, true)),
    );
    // Also include the original shared_flota instance
    const shared = await this.findSharedInstance();
    const sharedSynced = shared ? await this.syncConnectionState(shared, true) : null;
    const all = [...synced, ...(sharedSynced ? [sharedSynced] : [])].filter(Boolean);
    return all.map((inst) => this.serializeInstance(inst));
  }

  async createFlotaInstance(name: string, apiKey?: string) {
    if (!this.personalConnectionsEnabled()) {
      throw new ServiceUnavailableException(
        'Faltan EVOGO_MANAGER_API_KEY o EVOGO_WEBHOOK_URL para crear instancias de Flota',
      );
    }
    const webhookUrl = this.webhookUrl();
    const created = await this.evogo.createInstance({
      instanceName: name,
      webhook: { url: webhookUrl },
      token: apiKey || undefined,
    });
    const now = new Date();
    const instance = await this.prisma.whatsappInstance.create({
      data: {
        instanceType: 'flota_node',
        instanceName: created.instanceName,
        instanceApiKey: created.instanceApiKey,
        evoInstanceId: created.instanceId,
        status: created.qrCode || created.qrText || created.pairingCode
          ? 'qr_ready'
          : this.normalizeConnectionState(created.status),
        qrCode: created.qrCode,
        qrText: created.qrText,
        pairingCode: created.pairingCode,
        qrGeneratedAt: created.qrCode || created.qrText || created.pairingCode ? now : null,
        lastError: null,
      },
      select: WHATSAPP_INSTANCE_SELECT,
    }) as WhatsappInstanceRow;
    return { instance: this.serializeInstance(instance) };
  }

  async connectFlotaInstance(id: string) {
    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { id, instanceType: { in: ['flota_node', 'shared_flota'] } },
      select: WHATSAPP_INSTANCE_SELECT,
    }) as WhatsappInstanceRow | null;
    if (!instance) throw new NotFoundException('Instancia no encontrada');

    const synced = await this.syncConnectionState(instance, true);
    if (synced.status === 'open') {
      return { instance: this.serializeInstance(synced) };
    }
    const webhookUrl = this.webhookUrl();
    const qr = await this.evogo.connectInstance({
      instanceName: instance.instanceName,
      instanceApiKey: instance.instanceApiKey,
      webhookUrl,
    });
    const now = new Date();
    const hasQr = Boolean(qr.qrCode || qr.qrText || qr.pairingCode);
    const updated = await this.updateInstance(instance.id, {
      status: hasQr ? 'qr_ready' : instance.status,
      qrCode: qr.qrCode,
      qrText: qr.qrText,
      pairingCode: qr.pairingCode,
      qrGeneratedAt: hasQr ? now : null,
      lastError: null,
    });
    return { instance: this.serializeInstance(updated) };
  }

  async disconnectFlotaInstance(id: string) {
    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { id, instanceType: { in: ['flota_node', 'shared_flota'] } },
      select: WHATSAPP_INSTANCE_SELECT,
    }) as WhatsappInstanceRow | null;
    if (!instance) throw new NotFoundException('Instancia no encontrada');
    try {
      await this.evogo.logoutInstance({
        instanceName: instance.instanceName,
        instanceApiKey: instance.instanceApiKey,
      });
    } catch {
      // ignore
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
    return { instance: this.serializeInstance(updated) };
  }

  async deleteFlotaInstance(id: string) {
    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { id, instanceType: 'flota_node' },
      select: WHATSAPP_INSTANCE_SELECT,
    }) as WhatsappInstanceRow | null;
    if (!instance) throw new NotFoundException('Instancia no encontrada');
    try {
      await this.evogo.logoutInstance({
        instanceName: instance.instanceName,
        instanceApiKey: instance.instanceApiKey,
      });
    } catch {
      // ignore
    }
    await this.prisma.whatsappInstance.delete({ where: { id: instance.id } });
    return { ok: true };
  }

  /* ======== Flota Bulk Campaigns (historial) ======== */

  async listFlotaBulkCampaigns(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.flotaBulkCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.flotaBulkCampaign.count(),
    ]);
    return { items, total, page, limit };
  }

  async getFlotaBulkCampaign(id: string) {
    const campaign = await this.prisma.flotaBulkCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    return campaign;
  }

  async updateFlotaInstanceFlags(id: string, flags: { useForInbox?: boolean; useForMasivo?: boolean }) {
    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { id, instanceType: { in: ['flota_node', 'shared_flota'] } },
    });
    if (!instance) throw new NotFoundException('Instancia no encontrada');

    // If setting inbox, unset all others
    if (flags.useForInbox) {
      await this.prisma.whatsappInstance.updateMany({
        where: { instanceType: { in: ['flota_node', 'shared_flota'] }, id: { not: id } },
        data: { useForInbox: false },
      });
    }

    const updated = await this.prisma.whatsappInstance.update({
      where: { id },
      data: {
        ...(flags.useForInbox !== undefined ? { useForInbox: flags.useForInbox } : {}),
        ...(flags.useForMasivo !== undefined ? { useForMasivo: flags.useForMasivo } : {}),
      },
      select: WHATSAPP_INSTANCE_SELECT,
    }) as WhatsappInstanceRow;

    return { instance: this.serializeInstance(updated) };
  }

  async sendSharedTestMessage(dto: { number: string; text: string }) {
    const current = await this.findSharedInstance();
    if (!current) {
      throw new ServiceUnavailableException('Primero conecta el WhatsApp compartido de Flota');
    }
    const instance = await this.syncConnectionState(current, true);
    if (instance.status !== 'open') {
      throw new ServiceUnavailableException('El WhatsApp compartido de Flota aún no está conectado. Escanea el QR antes de enviar.');
    }
    const to = normalizePeWaNumber(dto.number);
    if (to.length < 8) {
      throw new ServiceUnavailableException('Ingresa un número de WhatsApp válido con código de país, sin signos ni espacios');
    }
    const text = dto.text.trim();
    if (!text) throw new ServiceUnavailableException('El mensaje de prueba no puede estar vacío');

    const sent = await this.evogo.sendText({
      instanceApiKey: instance.instanceApiKey,
      number: to,
      text,
    });
    if (!sent.ok) {
      const msg = typeof sent.raw === 'object' && sent.raw !== null && 'error' in sent.raw
        ? String((sent.raw as { error?: unknown }).error)
        : `Evolution GO respondió ${sent.status}`;
      throw new ServiceUnavailableException(`No se pudo enviar el mensaje: ${msg}`);
    }
    return { ok: true, to, waMessageId: sent.waMessageId ?? null };
  }

  private sharedEvoInstanceName(): string {
    return this.sharedInstanceName();
  }

  async getConversations(query?: string) {
    const instanceName = this.sharedEvoInstanceName();

    function normalizePhone(p: string): string {
      return p.replace(/^\+?51/, '').replace(/\D/g, '').slice(-9);
    }

    const rows = await this.prisma.crmWhatsappMessage.findMany({
      where: {
        evoInstanceName: instanceName,
        OR: [
          { flotaProspectoId: { not: null } },
          { flotaProspectoId: null, contactId: null },
        ],
      },
      select: {
        id: true,
        direction: true,
        body: true,
        fromWaId: true,
        toWaId: true,
        createdAt: true,
        waOutboundStatus: true,
        flotaProspectoId: true,
        flotaProspecto: {
          select: { id: true, nombreCompleto: true, celular: true, estado: true, lastReadAt: true, operador: true },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const grouped = new Map<string, {
      contactId: string;
      name: string;
      phone: string;
      lastMessage: string;
      lastTime: Date;
      lastDirection: string;
      unread: number;
      lastReadAt: Date | null;
      estado?: string;
      operador?: string | null;
      lastSender?: string;
    }>();

    for (const row of rows) {
      if (!row.flotaProspectoId) continue;
      const phoneRaw = row.flotaProspecto?.celular ?? row.fromWaId ?? '';
      const normalized = normalizePhone(phoneRaw);
      const existingEntry = Array.from(grouped.values()).find(
        (e) => normalizePhone(e.phone) === normalized,
      );
      if (!existingEntry) {
        const prospectLastReadAt = row.flotaProspecto?.lastReadAt ?? null;
        const isUnread = row.direction === 'inbound' && (!prospectLastReadAt || row.createdAt > prospectLastReadAt);
        grouped.set(row.flotaProspectoId, {
          contactId: row.flotaProspectoId,
          name: row.flotaProspecto?.nombreCompleto ?? row.fromWaId,
          phone: phoneRaw,
          lastMessage: row.body.slice(0, 100),
          lastTime: row.createdAt,
          lastDirection: row.direction,
          unread: isUnread ? 1 : 0,
          lastReadAt: prospectLastReadAt,
          estado: row.flotaProspecto?.estado ?? undefined,
          operador: row.flotaProspecto?.operador ?? null,
          lastSender: row.direction === 'outbound' ? (row as any).createdBy?.name : row.flotaProspecto?.nombreCompleto,
        });
      } else {
        if (row.createdAt.getTime() > existingEntry.lastTime.getTime()) {
          existingEntry.lastTime = row.createdAt;
          existingEntry.lastMessage = row.body.slice(0, 100);
          existingEntry.lastDirection = row.direction;
          existingEntry.lastSender = row.direction === 'outbound' ? (row as any).createdBy?.name : undefined;
        }
        if (row.direction === 'inbound' && (!existingEntry.lastReadAt || row.createdAt > existingEntry.lastReadAt)) {
          existingEntry.unread++;
        }
      }
    }

    let conversations = Array.from(grouped.values())
      .sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime());

    if (query?.trim()) {
      const q = query.trim().toLowerCase();
      conversations = conversations.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q),
      );
    }

    return conversations.map((c) => ({
      id: c.contactId,
      name: c.name,
      phone: c.phone,
      preview: c.lastMessage,
      time: c.lastTime.toISOString(),
      direction: c.lastDirection,
      unread: Math.min(c.unread, 99),
      estado: c.estado,
      operador: c.operador ?? undefined,
      lastSender: c.lastSender ?? c.name,
    }));
  }

  async markProspectoAsRead(prospectoId: string) {
    await this.prisma.flotaProspecto.update({
      where: { id: prospectoId },
      data: { lastReadAt: new Date() },
    });
  }

  async uploadFlotaAudio(buffer: Buffer, originalName: string, mimeType: string, userId: string): Promise<string> {
    let audioBuffer = buffer;
    let audioMime = mimeType;
    let audioName = originalName;
    if (mimeType.startsWith('audio/webm') || mimeType.startsWith('audio/ogg')) {
      try {
        audioBuffer = await this.convertWebmToMp3(buffer);
        audioMime = 'audio/mpeg';
        audioName = originalName.replace(/\.[^.]+$/, '.mp3');
      } catch (e) {
        this.logger.warn(`Error convirtiendo audio a MP3: ${String(e)}. Enviando como original.`);
      }
    }
    const authHeader = this.config.get<string>('MEDIA_UPLOAD_AUTHORIZATION')?.trim();
    const url = await this.files.create(userId, {
      buffer: audioBuffer,
      originalName: audioName,
      mimeType: audioMime,
      entityType: 'flota-prospecto',
      entityId: userId,
      entityName: 'audio-upload',
      relatedEntityType: 'whatsapp-message',
      relatedEntityName: 'audio-enviado',
      authorizationHeader: authHeader,
    }).then((file) => this.files.presignGet(file.id, 'inline')).then((r) => r.url);
    this.logger.log(`Audio subido: ${url} (${audioBuffer.length} bytes, ${audioMime})`);
    return url;
  }

  private convertWebmToMp3(input: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-c:a', 'libmp3lame',
        '-b:a', '32k',
        '-ac', '1',
        '-ar', '24000',
        '-f', 'mp3',
        'pipe:1',
      ]);
      const chunks: Buffer[] = [];
      ffmpeg.stdout.on('data', (c: Buffer) => chunks.push(c));
      let stderr = '';
      ffmpeg.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
      ffmpeg.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-200)}`));
        }
      });
      ffmpeg.on('error', reject);
      ffmpeg.stdin.end(input);
    });
  }

  async sendFromFlotaProspecto(prospectoId: string, text: string, imageUrl: string | undefined, audioUrl: string | undefined, userId: string) {
    // Try inbox instance first, then fall back to shared
    let instance = await this.prisma.whatsappInstance.findFirst({
      where: { useForInbox: true, status: 'open' },
      select: WHATSAPP_INSTANCE_SELECT,
    }) as WhatsappInstanceRow | null;
    if (!instance) {
      const shared = await this.findSharedInstance();
      if (shared) instance = await this.syncConnectionState(shared, true);
    }
    if (!instance || instance.status !== 'open') {
      throw new ServiceUnavailableException('No hay ninguna instancia de WhatsApp conectada para enviar mensajes.');
    }

    const prospecto = await this.prisma.flotaProspecto.findUnique({ where: { id: prospectoId } });
    if (!prospecto) {
      throw new BadRequestException('Prospecto no encontrado');
    }

    const phoneRaw = prospecto.celular ?? prospecto.movil;
    if (!phoneRaw) {
      throw new BadRequestException('El prospecto no tiene un celular registrado');
    }

    const to = normalizePeWaNumber(phoneRaw);
    if (to.length < 8) {
      throw new ServiceUnavailableException('El prospecto no tiene un teléfono válido para WhatsApp');
    }

    let sent: EvogoSendTextResult;
    const caption = text.trim() || undefined;
    if (imageUrl) {
      sent = await this.evogo.sendMedia({
        instanceApiKey: instance.instanceApiKey,
        number: to,
        mediaUrl: imageUrl,
        mediatype: 'image',
        caption,
      });
    } else if (audioUrl) {
      sent = await this.evogo.sendMedia({
        instanceApiKey: instance.instanceApiKey,
        number: to,
        mediaUrl: audioUrl,
        mediatype: 'audio',
        mimeType: 'audio/mpeg',
        caption,
      });
    } else {
      sent = await this.evogo.sendText({
        instanceApiKey: instance.instanceApiKey,
        number: to,
        text: text.trim(),
      });
    }
    if (!sent.ok) {
      const msg = typeof sent.raw === 'object' && sent.raw !== null && 'error' in sent.raw
        ? String((sent.raw as { error?: unknown }).error)
        : `Evolution GO respondió ${sent.status}`;
      throw new ServiceUnavailableException(`No se pudo enviar: ${msg}`);
    }

    const body = imageUrl ? (caption || '') : audioUrl ? (caption || '') : text.trim();

    const created = await this.prisma.crmWhatsappMessage.create({
      data: {
        direction: 'outbound',
        evoInstanceId: instance.evoInstanceId ?? instance.instanceName,
        evoInstanceName: instance.instanceName,
        waMessageId: sent.waMessageId ?? null,
        fromWaId: instance.displayLineId ?? instance.instanceName,
        toWaId: to,
        body,
        payloadJson: stripHeavyPayload(sent.raw) as Prisma.InputJsonValue,
        flotaProspectoId: prospectoId,
        whatsappInstanceId: instance.id,
        createdByUserId: userId,
        waOutboundStatus: 'sent',
      },
    });

    if (imageUrl || audioUrl) {
      try {
        const isAudio = !!audioUrl;
        await this.prisma.crmFile.create({
          data: {
            storageKey: imageUrl || audioUrl || '',
            originalName: isAudio ? 'audio-enviado.mp3' : 'imagen-enviada.jpg',
            mimeType: isAudio ? 'audio/mpeg' : 'image/jpeg',
            size: 0,
            entityType: 'flota-prospecto',
            entityId: prospectoId,
            entityName: prospecto.nombreCompleto?.trim() || null,
            relatedEntityType: 'whatsapp-message',
            relatedEntityId: created.id,
            relatedEntityName: isAudio ? 'audio-enviado' : 'imagen-enviada',
            uploadedBy: userId,
          },
        });
      } catch (e) {
        this.logger.warn(`No se pudo crear adjunto de medio saliente ${created.id}: ${String(e)}`);
      }
    }

    await this.emitListItemById(prospectoId, created.id);

    // Auto-asignar al operador que envía el primer mensaje
    if (!prospecto.operador?.trim()) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, role: { select: { slug: true } } },
      });
      if (user?.name && user?.role?.slug === 'operador') {
        await this.prisma.flotaProspecto.update({
          where: { id: prospectoId },
          data: { operador: user.name },
        });
      }
    }

    return { ok: true, waMessageId: sent.waMessageId ?? null };
  }

  async sendBulk(dto: {
    contactIds: string[];
    text: string;
    imageUrl?: string;
  }, scope: any, userId: string) {
    const current = await this.findSharedInstance();
    if (!current) {
      throw new ServiceUnavailableException('El WhatsApp compartido de Flota no está configurado. Conéctalo primero.');
    }
    const instance = await this.syncConnectionState(current, true);
    if (instance.status !== 'open') {
      throw new ServiceUnavailableException('La instancia compartida de WhatsApp no está conectada.');
    }

    if (!dto.text && !dto.imageUrl) {
      throw new BadRequestException('text o imageUrl son obligatorios');
    }
    if (!dto.contactIds?.length) {
      throw new BadRequestException('Selecciona al menos un destinatario');
    }

    const sender = {
      instanceApiKey: instance.instanceApiKey,
      evoInstanceId: instance.evoInstanceId || this.defaultInstanceId(),
      evoInstanceName: instance.instanceName,
      displayLineId: instance.instanceName,
    };

    const results: Array<{ contactId: string; status: string; error?: string; messageId?: string }> = [];

    for (let i = 0; i < dto.contactIds.length; i++) {
      const contactId = dto.contactIds[i]!;
      if (i > 0) {
        const delay = 5000 + Math.floor(Math.random() * 10000);
        await new Promise((r) => setTimeout(r, delay));
      }
      try {
        const contact = await this.contactsService.findOne(contactId, scope);
        const to = normalizePeWaNumber(contact.telefono);
        if (to.length < 8) {
          results.push({ contactId, status: 'fallido', error: 'Sin teléfono válido' });
          continue;
        }

        const personalizedText = dto.text
          .replaceAll('{{nombre}}', contact.name ?? '')
          .replaceAll('{{empresa}}', '')
          .replaceAll('{{celular}}', contact.telefono ?? '');

        const finalBody = personalizedText || dto.text;

        let sent;
        if (dto.imageUrl) {
          sent = await this.evogo.sendMedia({
            instanceApiKey: sender.instanceApiKey,
            number: to,
            mediaUrl: dto.imageUrl,
            mediatype: 'image',
            caption: finalBody || undefined,
          });
        } else {
          sent = await this.evogo.sendText({
            instanceApiKey: sender.instanceApiKey,
            number: to,
            text: finalBody,
          });
        }

        if (!sent.ok) {
          const errMsg = typeof sent.raw === 'object' && sent.raw !== null && 'error' in sent.raw
            ? String((sent.raw as { error?: unknown }).error)
            : `HTTP ${sent.status}`;
          results.push({ contactId, status: 'fallido', error: errMsg });
          continue;
        }

        const row = await this.prisma.crmWhatsappMessage.create({
          data: {
            direction: 'outbound',
            evoInstanceId: sender.evoInstanceId,
            evoInstanceName: sender.evoInstanceName,
            waMessageId: sent.waMessageId ?? null,
            fromWaId: sender.displayLineId,
            toWaId: to,
            body: finalBody || (dto.imageUrl ? '[Imagen]' : '[Sin texto]'),
            payloadJson: {
              ...(stripHeavyPayload(sent.raw) as Record<string, unknown>),
              ...(dto.imageUrl ? { imageUrl: dto.imageUrl } : {}),
            } as Prisma.InputJsonValue,
            contactId: contact.id,
            createdByUserId: userId,
            waOutboundStatus: 'sent',
          },
        });

        await this.emitListItemById(contact.id, row.id);
        results.push({ contactId, status: 'enviado', messageId: row.id });
      } catch (e) {
        results.push({
          contactId,
          status: 'fallido',
          error: e instanceof Error ? e.message : 'Error desconocido',
        });
      }
    }

    return {
      total: dto.contactIds.length,
      enviados: results.filter((r) => r.status === 'enviado').length,
      fallidos: results.filter((r) => r.status === 'fallido').length,
      results,
    };
  }

  async importExcelPreview(fileBuffer: Buffer) {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException('No se pudo leer el archivo. Asegúrate de que sea un .xlsx válido.');
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('El archivo no contiene hojas.');
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new BadRequestException('No se pudo leer la hoja del archivo.');
    }

    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      throw new BadRequestException('El archivo está vacío.');
    }

    const columns = Object.keys(rows[0]!);

    const nameKey = columns.find((k) => {
      const lower = k.trim().toLowerCase();
      return lower === 'nombre' || lower === 'name' || lower === 'nombres' || lower === 'nombre completo';
    }) ?? null;

    const phoneKey = columns.find((k) => {
      const lower = k.trim().toLowerCase();
      return lower === 'telefono' || lower === 'celular' || lower === 'phone' || lower === 'teléfono' || lower === 'tel';
    }) ?? null;

    if (!phoneKey) {
      throw new BadRequestException(
        'No se encontró la columna de teléfono. El archivo debe tener una columna: telefono, celular, phone o tel.',
      );
    }

    const items: Array<{ name: string; phone: string; contactId: string | null }> = [];

    // Collect all unique phones from the Excel
    const uniquePhones = new Set<string>();
    for (const row of rows) {
      const phone = digitsOnly(String(row[phoneKey] ?? ''));
      if (phone && phone.length >= 8) uniquePhones.add(phone);
    }

    // Build all candidates for bulk query
    const allCandidates: string[] = [];
    const candidateToOriginal = new Map<string, string>();
    for (const phone of uniquePhones) {
      for (const cand of this.waNumberCandidates(phone)) {
        allCandidates.push(cand);
        candidateToOriginal.set(cand, phone);
      }
    }

    // Single bulk query to resolve all phones at once
    const phoneCache = new Map<string, string | null>();
    if (allCandidates.length > 0) {
      const contactRows = await this.prisma.$queryRaw<Array<{ id: string; telefono: string }>>`
        SELECT id, telefono
        FROM "Contact"
        WHERE telefono IS NOT NULL
          AND regexp_replace(telefono, '\D', '', 'g') = ANY(${allCandidates}::text[])
      `;
      for (const cr of contactRows) {
        const clean = digitsOnly(cr.telefono);
        if (clean) {
          const original = candidateToOriginal.get(clean);
          if (original && !phoneCache.has(original)) {
            phoneCache.set(original, cr.id);
          }
        }
      }
    }

    // Build items without any further DB queries
    for (const row of rows) {
      const phone = digitsOnly(String(row[phoneKey] ?? ''));
      if (!phone || phone.length < 8) continue;

      const contactId = phoneCache.get(phone) ?? null;
      const name = String(row[nameKey ?? ''] ?? '').trim() || phone;

      items.push({ name, phone, contactId });
    }

    return { items, total: items.length };
  }

  // ======== Flota Bulk Send ========

  private flotaBulkJobs = new Map<string, {
    jobId: string;
    total: number;
    sent: number;
    failed: number;
    currentName: string;
    currentIndex: number;
    nextDelay: number;
    finished: boolean;
    cancelled: boolean;
    paused: boolean;
    results: Array<{ contactId: string; status: string; error?: string; messageId?: string }>;
  }>();

  async sendFlotaBulk(params: {
    prospectoIds: string[];
    text: string;
    imageUrl?: string;
    userId: string;
  }): Promise<{ jobId: string; campaignId: string }> {
    // Build pool of masivo instances
    let instances = await this.prisma.whatsappInstance.findMany({
      where: { useForMasivo: true, status: 'open' },
      select: WHATSAPP_INSTANCE_SELECT,
      orderBy: { createdAt: 'asc' },
    }) as WhatsappInstanceRow[];
    if (instances.length === 0) {
      const shared = await this.findSharedInstance();
      if (shared) {
        const synced = await this.syncConnectionState(shared, true);
        if (synced.status === 'open') instances = [synced];
      }
    }
    if (instances.length === 0) {
      throw new ServiceUnavailableException('No hay instancias de WhatsApp conectadas para el envío masivo. Marcá al menos una en Conexiones.');
    }

    // Create campaign record
    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { name: true },
    });
    const campaign = await this.prisma.flotaBulkCampaign.create({
      data: {
        name: `Masivo ${new Date().toLocaleDateString('es-PE')}`,
        message: params.text,
        total: params.prospectoIds.length,
        status: 'sending',
        imageUrl: params.imageUrl || null,
        createdById: params.userId,
        createdByName: user?.name || 'Sistema',
      },
    });

    const jobId = `flota-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const BULK_DELAYS = [35000, 45000, 55000, 65000];

    const job = {
      jobId,
      total: params.prospectoIds.length,
      sent: 0,
      failed: 0,
      currentName: '',
      currentIndex: 0,
      nextDelay: BULK_DELAYS[0]!,
      finished: false,
      cancelled: false,
      paused: false,
      results: [] as Array<{ contactId: string; status: string; error?: string; messageId?: string }>,
    };
    this.flotaBulkJobs.set(jobId, job);

    const emit = () => {
      this.gateway.emitFlotaBulkProgress({
        type: 'flota-bulk-progress',
        jobId,
        total: job.total,
        sent: job.sent,
        failed: job.failed,
        currentName: job.currentName,
        currentIndex: job.currentIndex,
        nextDelay: job.nextDelay,
        finished: job.finished,
        cancelled: job.cancelled,
        paused: job.paused,
      });
    };

    // Process in background
    void (async () => {
      let currentInstIdx = 0;
      const getCurrentInst = () => instances[currentInstIdx % instances.length]!;

      for (let i = 0; i < params.prospectoIds.length; i++) {
        if (job.cancelled) break;

        while (job.paused && !job.cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        if (job.cancelled) break;

        const senderInst = getCurrentInst();
        currentInstIdx++;
        const prospectoId = params.prospectoIds[i]!;
        const delayMs = BULK_DELAYS[i % BULK_DELAYS.length]!;

        try {
          const prospecto = await this.prisma.flotaProspecto.findUnique({
            where: { id: prospectoId },
            select: { id: true, nombreCompleto: true, celular: true, movil: true },
          });

          if (!prospecto) {
            job.failed++;
            job.results.push({ contactId: prospectoId, status: 'fallido', error: 'Prospecto no encontrado' });
            emit();
            continue;
          }

          const rawPhone = prospecto.celular ?? prospecto.movil;
          if (!rawPhone) {
            job.failed++;
            job.results.push({ contactId: prospectoId, status: 'fallido', error: 'Sin teléfono' });
            emit();
            continue;
          }

          const to = normalizePeWaNumber(rawPhone);
          if (to.length < 8) {
            job.failed++;
            job.results.push({ contactId: prospectoId, status: 'fallido', error: 'Teléfono inválido' });
            emit();
            continue;
          }

          job.currentName = prospecto.nombreCompleto || prospectoId;
          job.currentIndex = i;
          job.nextDelay = BULK_DELAYS[(i + 1) % BULK_DELAYS.length]!;
          emit();

          const personalized = params.text
            .replaceAll('{{nombre}}', prospecto.nombreCompleto || '')
            .replaceAll('{{celular}}', rawPhone)
            .replaceAll('{{empresa}}', '');
          const finalBody = personalized || params.text;

          let sent;
          if (params.imageUrl) {
            sent = await this.evogo.sendMedia({
              instanceApiKey: senderInst.instanceApiKey,
              number: to,
              mediaUrl: params.imageUrl,
              mediatype: 'image',
              caption: finalBody || undefined,
            });
          } else {
            sent = await this.evogo.sendText({
              instanceApiKey: senderInst.instanceApiKey,
              number: to,
              text: finalBody,
            });
          }

          if (!sent.ok) {
            const errMsg = typeof sent.raw === 'object' && sent.raw !== null && 'error' in sent.raw
              ? String((sent.raw as { error?: unknown }).error)
              : `HTTP ${sent.status}`;
            job.failed++;
            job.results.push({ contactId: prospectoId, status: 'fallido', error: errMsg });
          } else {
            const body = params.imageUrl ? (finalBody || '') : params.text.trim();
            const created = await this.prisma.crmWhatsappMessage.create({
              data: {
                direction: 'outbound',
                evoInstanceId: senderInst.evoInstanceId || this.defaultInstanceId(),
                evoInstanceName: senderInst.instanceName,
                waMessageId: sent.waMessageId ?? null,
                fromWaId: senderInst.instanceName,
                toWaId: to,
                body,
                payloadJson: stripHeavyPayload(sent.raw) as Prisma.InputJsonValue,
                flotaProspectoId: prospectoId,
                whatsappInstanceId: senderInst.id,
                createdByUserId: params.userId,
                waOutboundStatus: 'sent',
              },
            });
            job.sent++;
            job.results.push({ contactId: prospectoId, status: 'enviado', messageId: created.id });
            await this.gateway.emitToContact(prospectoId, {
              type: 'message',
              contactId: prospectoId,
              item: {
                id: created.id,
                direction: 'outbound',
                body,
                fromWaId: senderInst.instanceName,
                toWaId: to,
                createdAt: created.createdAt.toISOString(),
                waOutboundStatus: 'sent',
                attachments: [],
              } as Record<string, unknown>,
            });
          }
        } catch (e) {
          job.failed++;
          job.results.push({
            contactId: prospectoId,
            status: 'fallido',
            error: e instanceof Error ? e.message : 'Error desconocido',
          });
        }
        emit();

        if (i < params.prospectoIds.length - 1 && !job.cancelled) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      job.finished = true;
      emit();
      // Update campaign record
      await this.prisma.flotaBulkCampaign.update({
        where: { id: campaign.id },
        data: {
          sent: job.sent,
          failed: job.failed,
          status: job.cancelled ? 'cancelled' : 'sent',
        },
      });
      // Clean up after 10 minutes
      setTimeout(() => this.flotaBulkJobs.delete(jobId), 600000);
    })();

    return { jobId, campaignId: campaign.id };
  }

  getFlotaBulkProgress(jobId: string) {
    const job = this.flotaBulkJobs.get(jobId);
    if (!job) return null;
    return {
      jobId: job.jobId,
      total: job.total,
      sent: job.sent,
      failed: job.failed,
      currentName: job.currentName,
      currentIndex: job.currentIndex,
      nextDelay: job.nextDelay,
      finished: job.finished,
      cancelled: job.cancelled,
      paused: job.paused,
    };
  }

  cancelFlotaBulk(jobId: string) {
    const job = this.flotaBulkJobs.get(jobId);
    if (!job) return false;
    job.cancelled = true;
    return true;
  }

  pauseFlotaBulk(jobId: string) {
    const job = this.flotaBulkJobs.get(jobId);
    if (!job) return false;
    job.paused = true;
    return true;
  }

  resumeFlotaBulk(jobId: string) {
    const job = this.flotaBulkJobs.get(jobId);
    if (!job) return false;
    job.paused = false;
    return true;
  }
}
