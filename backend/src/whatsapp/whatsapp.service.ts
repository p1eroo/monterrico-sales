import {
  BadRequestException,
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
  resolveEvolutionMediaUrl,
  stripHeavyPayload,
} from './evolution-webhook.util';
import { WhatsappGateway } from './whatsapp.gateway';
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

    // Si el usuario tiene instancia personal (comercial), usarla
    if (personal && (!override || override === personal.instanceApiKey)) {
      return {
        instanceApiKey: personal.instanceApiKey,
        evoInstanceId: personal.evoInstanceId || personal.instanceName,
        evoInstanceName: personal.instanceName,
        displayLineId: personal.displayLineId || personal.instanceName,
        whatsappInstanceId: personal.id,
      };
    }

    // Si la instancia compartida de flota está conectada, usarla (cubre envíos desde inbox/masivo)
    if (this.sharedInstanceCache?.instanceApiKey && this.sharedInstanceCache.status === 'open') {
      return {
        instanceApiKey: this.sharedInstanceCache.instanceApiKey,
        evoInstanceId: this.sharedInstanceCache.evoInstanceId || this.defaultInstanceId(),
        evoInstanceName: this.sharedInstanceCache.instanceName,
        displayLineId: this.sharedInstanceCache.instanceName,
        whatsappInstanceId: null,
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
    try {
      const resolvedUrl = resolveEvolutionMediaUrl(
        media.url,
        this.evolutionBaseUrl(),
      );
      let bytes = this.decodeWhatsappMediaBase64(media.base64);
      if (!bytes && resolvedUrl) {
        try {
          bytes = await this.downloadWhatsappMedia(resolvedUrl);
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
    await this.contactsService.findOne(contactId, scope);
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
      // Verificar si es la instancia compartida de flota
      if (this.sharedInstanceCache && base.instanceName === this.sharedInstanceCache.instanceName) {
        const data = asRecord(base.data);
        const qrcode = asRecord(data?.['qrcode']) ?? asRecord(data?.['Qrcode']) ?? data;
        const qrCode = typeof qrcode?.['base64'] === 'string' ? qrcode['base64']
          : typeof qrcode?.['Base64'] === 'string' ? qrcode['Base64'] : null;
        const qrText = typeof qrcode?.['code'] === 'string' ? qrcode['code']
          : typeof qrcode?.['Code'] === 'string' ? qrcode['Code'] : null;
        const pairingCode = typeof qrcode?.['pairingCode'] === 'string' ? qrcode['pairingCode']
          : typeof qrcode?.['PairingCode'] === 'string' ? qrcode['PairingCode'] : null;
        const now = new Date();
        this.sharedInstanceCache.status = 'qr_ready';
        this.sharedInstanceCache.evoInstanceId = base.instanceId || this.sharedInstanceCache.evoInstanceId;
        this.sharedInstanceCache.qrCode = qrCode;
        this.sharedInstanceCache.qrText = qrText;
        this.sharedInstanceCache.pairingCode = pairingCode;
        this.sharedInstanceCache.qrGeneratedAt = now;
        this.sharedInstanceCache.qrExpiresAt = this.qrExpiryDate(now);
        this.sharedInstanceCache.lastError = null;
        return { ok: true };
      }

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
      // Verificar si es la instancia compartida de flota (en memoria, no en BD)
      if (this.sharedInstanceCache && base.instanceName === this.sharedInstanceCache.instanceName) {
        const data = asRecord(base.data);
        const nextStatus = this.normalizeConnectionState(
          this.readConnectionStateFromPayload(data),
        );
        const now = new Date();
        this.sharedInstanceCache.status = nextStatus;
        this.sharedInstanceCache.evoInstanceId = base.instanceId || this.sharedInstanceCache.evoInstanceId;
        if (nextStatus === 'open') {
          this.sharedInstanceCache.qrCode = null;
          this.sharedInstanceCache.qrText = null;
          this.sharedInstanceCache.pairingCode = null;
          this.sharedInstanceCache.qrGeneratedAt = null;
          this.sharedInstanceCache.qrExpiresAt = null;
          this.sharedInstanceCache.lastError = null;
        } else if (nextStatus === 'close') {
          this.sharedInstanceCache.status = 'close';
        }
        return { ok: true };
      }

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

    const contact = await this.findContactByLoosePhone(peerDigits);
    if (!contact?.id) {
      return { ok: true, ignored: 'contact_not_found' };
    }
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
        contactId: contact.id,
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

    await this.emitListItemById(contact.id, created.id);

    if (contact.assignedTo) {
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

  // ─── Instancia compartida de Flota (sin BD, estado en memoria) ───

  private sharedInstanceCache: {
    instanceName: string;
    instanceApiKey: string;
    evoInstanceId: string | null;
    status: string;
    qrCode: string | null;
    qrText: string | null;
    pairingCode: string | null;
    qrGeneratedAt: Date | null;
    qrExpiresAt: Date | null;
    lastError: string | null;
  } | null = null;

  private sharedInstanceName(): string {
    const env = this.config.get<string>('EVOGO_INSTANCE_NAME')?.trim();
    return env ? `${env}-flota` : 'crm-flota';
  }

  private serializeSharedInstance() {
    if (!this.sharedInstanceCache) return null;
    const i = this.sharedInstanceCache;
    return {
      instanceName: i.instanceName,
      evoInstanceId: i.evoInstanceId,
      status: i.status,
      isConnected: i.status === 'open',
      qrCode: i.qrCode,
      qrText: i.qrText,
      pairingCode: i.pairingCode,
      qrGeneratedAt: i.qrGeneratedAt?.toISOString() ?? null,
      qrExpiresAt: i.qrExpiresAt?.toISOString() ?? null,
      lastError: i.lastError,
    };
  }

  async getSharedConnection() {
    if (this.sharedInstanceCache && this.sharedInstanceCache.instanceApiKey) {
      try {
        const remote = await this.evogo.connectionState({
          instanceName: this.sharedInstanceCache.instanceName,
          instanceApiKey: this.sharedInstanceCache.instanceApiKey,
        });
        const newStatus = this.normalizeConnectionState(remote.state);
        this.sharedInstanceCache.status = newStatus;
        if (newStatus === 'open') {
          this.sharedInstanceCache.qrCode = null;
          this.sharedInstanceCache.qrText = null;
          this.sharedInstanceCache.pairingCode = null;
          this.sharedInstanceCache.qrGeneratedAt = null;
          this.sharedInstanceCache.qrExpiresAt = null;
          this.sharedInstanceCache.lastError = null;
        }
      } catch {
        // swallow — devolvemos lo que tengamos en caché
      }
    }

    // Sin caché (tras reinicio del servidor): reconstruir desde env vars consultando Evolution GO
    if (!this.sharedInstanceCache) {
      const name = this.sharedInstanceName();
      const key = this.defaultInstanceKey();
      try {
        const remote = await this.evogo.connectionState({
          instanceName: name,
          instanceApiKey: key,
        });
        const status = this.normalizeConnectionState(remote.state);
        this.sharedInstanceCache = {
          instanceName: name,
          instanceApiKey: key,
          evoInstanceId: this.defaultInstanceId(),
          status,
          qrCode: null,
          qrText: null,
          pairingCode: null,
          qrGeneratedAt: null,
          qrExpiresAt: null,
          lastError: null,
        };
      } catch {
        // No se pudo contactar Evolution GO — se muestra como desconectado
      }
    }

    return {
      canManage: this.personalConnectionsEnabled(),
      instance: this.serializeSharedInstance(),
    };
  }

  async connectSharedWhatsapp() {
    if (!this.personalConnectionsEnabled()) {
      throw new ServiceUnavailableException(
        'Faltan EVOGO_MANAGER_API_KEY o EVOGO_WEBHOOK_URL para conectar el WhatsApp compartido de Flota',
      );
    }

    const webhookUrl = this.webhookUrl();

    // Si ya hay instancia en caché, intentar reconectar la existente
    if (this.sharedInstanceCache?.instanceApiKey && this.sharedInstanceCache.status !== 'close') {
      const cached = this.sharedInstanceCache;
      try {
        const remote = await this.evogo.connectionState({
          instanceName: cached.instanceName,
          instanceApiKey: cached.instanceApiKey,
        });
        const newStatus = this.normalizeConnectionState(remote.state);
        cached.status = newStatus;
        if (newStatus === 'open') {
          cached.qrCode = null;
          cached.qrText = null;
          cached.pairingCode = null;
          cached.qrGeneratedAt = null;
          cached.qrExpiresAt = null;
          cached.lastError = null;
          return { canManage: true, instance: this.serializeSharedInstance() };
        }
        if (newStatus === 'close') {
          // La instancia fue desconectada desde fuera → crear una nueva
          this.sharedInstanceCache = null;
        }
      } catch {
        // instancia no encontrada en Evolution → crear una nueva
        this.sharedInstanceCache = null;
      }

      // Si la caché aún existe (status no es 'close'), intentar regenerar QR
      if (this.sharedInstanceCache) {
        try {
          const qr = await this.evogo.connectInstance({
            instanceName: cached.instanceName,
            instanceApiKey: cached.instanceApiKey,
            webhookUrl,
          });
          const now = new Date();
          const hasQr = Boolean(qr.qrCode || qr.qrText);
          cached.status = hasQr ? 'qr_ready' : 'pending';
          cached.qrCode = qr.qrCode ?? null;
          cached.qrText = qr.qrText ?? null;
          cached.pairingCode = qr.pairingCode;
          cached.qrGeneratedAt = hasQr ? now : null;
          cached.qrExpiresAt = hasQr ? this.qrExpiryDate(now) : null;
          cached.lastError = hasQr ? null : 'Evolution GO no devolvió el QR todavía. Intenta nuevamente.';
          return { canManage: true, instance: this.serializeSharedInstance() };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'No se pudo regenerar el QR';
          this.logger.warn(`connectInstance falló para instancia compartida, se creará una nueva: ${msg}`);
          this.sharedInstanceCache = null;
        }
      }
    }

    // Primera vez: crear instancia nueva (usando token fijo de env vars para persistir tras reinicio)
    const name = this.sharedInstanceName();
    const token = this.defaultInstanceKey();
    let created;
    try {
      created = await this.evogo.createInstance({
        instanceName: name,
        webhook: { url: webhookUrl },
        token,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear instancia compartida';
      throw new ServiceUnavailableException(msg);
    }

    const now = new Date();
    const hasQr = Boolean(created.qrCode || created.qrText);

    this.sharedInstanceCache = {
      instanceName: created.instanceName,
      instanceApiKey: created.instanceApiKey,
      evoInstanceId: created.instanceId,
      status: hasQr ? 'qr_ready' : this.normalizeConnectionState(created.status),
      qrCode: created.qrCode,
      qrText: created.qrText,
      pairingCode: created.pairingCode,
      qrGeneratedAt: hasQr ? now : null,
      qrExpiresAt: hasQr ? this.qrExpiryDate(now) : null,
      lastError: null,
    };

    if (this.sharedInstanceCache.status === 'open') {
      return {
        canManage: true,
        instance: this.serializeSharedInstance(),
      };
    }

    try {
      const qr = await this.evogo.connectInstance({
        instanceName: this.sharedInstanceCache.instanceName,
        instanceApiKey: this.sharedInstanceCache.instanceApiKey,
        webhookUrl,
      });
      const qrNow = new Date();
      const hasConnectQr = Boolean(qr.qrCode || qr.qrText);
      this.sharedInstanceCache.status = hasConnectQr ? 'qr_ready' : 'pending';
      this.sharedInstanceCache.qrCode = qr.qrCode ?? null;
      this.sharedInstanceCache.qrText = qr.qrText ?? null;
      this.sharedInstanceCache.pairingCode = qr.pairingCode;
      this.sharedInstanceCache.qrGeneratedAt = hasConnectQr ? qrNow : null;
      this.sharedInstanceCache.qrExpiresAt = hasConnectQr ? this.qrExpiryDate(qrNow) : null;
      this.sharedInstanceCache.lastError = hasConnectQr
        ? null
        : 'Evolution GO no devolvió el QR todavía. Intenta nuevamente en unos segundos.';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo generar el QR';
      this.sharedInstanceCache.lastError = msg;
      throw new ServiceUnavailableException(msg);
    }

    return {
      canManage: true,
      instance: this.serializeSharedInstance(),
    };
  }

  async disconnectSharedWhatsapp() {
    if (!this.sharedInstanceCache?.instanceApiKey) {
      return { canManage: this.personalConnectionsEnabled(), instance: null };
    }
    try {
      await this.evogo.logoutInstance({
        instanceName: this.sharedInstanceCache.instanceName,
        instanceApiKey: this.sharedInstanceCache.instanceApiKey,
      });
    } catch {
      // Si Evolution GO no responde al logout, marcamos como desconectado igual
    }
    this.sharedInstanceCache.status = 'close';
    this.sharedInstanceCache.qrCode = null;
    this.sharedInstanceCache.qrText = null;
    this.sharedInstanceCache.pairingCode = null;
    this.sharedInstanceCache.qrGeneratedAt = null;
    this.sharedInstanceCache.qrExpiresAt = null;
    this.sharedInstanceCache.lastError = null;
    return {
      canManage: this.personalConnectionsEnabled(),
      instance: this.serializeSharedInstance(),
    };
  }

  async sendSharedTestMessage(dto: { number: string; text: string }) {
    if (!this.sharedInstanceCache?.instanceApiKey) {
      throw new ServiceUnavailableException(
        'Primero conecta el WhatsApp compartido de Flota para enviar un mensaje de prueba',
      );
    }

    if (this.sharedInstanceCache.status !== 'open') {
      await this.getSharedConnection();
    }

    if (this.sharedInstanceCache.status !== 'open') {
      throw new ServiceUnavailableException(
        'El WhatsApp compartido de Flota aún no está conectado. Escanea el QR antes de enviar.',
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
      instanceApiKey: this.sharedInstanceCache.instanceApiKey,
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
      throw new ServiceUnavailableException(`No se pudo enviar el mensaje: ${msg}`);
    }

    return { ok: true, to, waMessageId: sent.waMessageId ?? null };
  }

  private sharedEvoInstanceName(): string {
    return this.sharedInstanceCache?.instanceName ?? this.sharedInstanceName();
  }

  async getConversations(query?: string) {
    const instanceName = this.sharedEvoInstanceName();
    const rows = await this.prisma.crmWhatsappMessage.findMany({
      where: {
        evoInstanceName: instanceName,
        contactId: { not: null },
      },
      select: {
        id: true,
        direction: true,
        body: true,
        fromWaId: true,
        toWaId: true,
        createdAt: true,
        waOutboundStatus: true,
        contactId: true,
        contact: {
          select: { id: true, name: true, telefono: true },
        },
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
    }>();

    for (const row of rows) {
      if (!row.contactId) continue;
      const existing = grouped.get(row.contactId);
      if (!existing) {
        grouped.set(row.contactId, {
          contactId: row.contactId,
          name: row.contact?.name ?? row.fromWaId,
          phone: row.contact?.telefono ?? row.fromWaId,
          lastMessage: row.body.slice(0, 100),
          lastTime: row.createdAt,
          lastDirection: row.direction,
          unread: row.direction === 'inbound' ? 1 : 0,
        });
      } else if (row.direction === 'inbound') {
        existing.unread++;
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
    }));
  }

  async sendBulk(dto: {
    contactIds: string[];
    text: string;
  }, scope: any, userId: string) {
    if (!this.sharedInstanceCache?.instanceApiKey) {
      throw new ServiceUnavailableException(
        'El WhatsApp compartido de Flota no está configurado. Conéctalo primero.',
      );
    }

    if (this.sharedInstanceCache.status !== 'open') {
      await this.getSharedConnection();
    }

    if (this.sharedInstanceCache.status !== 'open') {
      throw new ServiceUnavailableException(
        'La instancia compartida de WhatsApp no está conectada.',
      );
    }

    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }
    if (!dto.contactIds?.length) {
      throw new BadRequestException('Selecciona al menos un destinatario');
    }

    const sender = {
      instanceApiKey: this.sharedInstanceCache.instanceApiKey,
      evoInstanceId: this.sharedInstanceCache.evoInstanceId || this.defaultInstanceId(),
      evoInstanceName: this.sharedInstanceCache.instanceName,
      displayLineId: this.sharedInstanceCache.instanceName,
    };

    const results: Array<{ contactId: string; status: string; error?: string; messageId?: string }> = [];

    for (const contactId of dto.contactIds) {
      try {
        const contact = await this.contactsService.findOne(contactId, scope);
        const to = normalizePeWaNumber(contact.telefono);
        if (to.length < 8) {
          results.push({ contactId, status: 'fallido', error: 'Sin teléfono válido' });
          continue;
        }

        const sent = await this.evogo.sendText({
          instanceApiKey: sender.instanceApiKey,
          number: to,
          text,
        });

        if (!sent.ok) {
          const errMsg = typeof sent.raw === 'object' && sent.raw !== null && 'error' in sent.raw
            ? String((sent.raw as { error?: unknown }).error)
            : `HTTP ${sent.status}`;
          results.push({ contactId, status: 'fallido', error: errMsg });
          continue;
        }

        const personalizedText = text
          .replaceAll('{{nombre}}', contact.name ?? '')
          .replaceAll('{{empresa}}', '')
          .replaceAll('{{celular}}', contact.telefono ?? '');

        const finalBody = personalizedText || text;

        const row = await this.prisma.crmWhatsappMessage.create({
          data: {
            direction: 'outbound',
            evoInstanceId: sender.evoInstanceId,
            evoInstanceName: sender.evoInstanceName,
            waMessageId: sent.waMessageId ?? null,
            fromWaId: sender.displayLineId,
            toWaId: to,
            body: finalBody,
            payloadJson: stripHeavyPayload(sent.raw) as Prisma.InputJsonValue,
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
    const phoneCache = new Map<string, string | null>();

    for (const row of rows) {
      const phone = digitsOnly(String(row[phoneKey] ?? ''));
      if (!phone || phone.length < 8) continue;

      let contactId: string | null = null;
      if (phoneCache.has(phone)) {
        contactId = phoneCache.get(phone) ?? null;
      } else {
        const contact = await this.findContactByLoosePhone(phone);
        contactId = contact?.id ?? null;
        phoneCache.set(phone, contactId);
      }

      const name = String(row[nameKey ?? ''] ?? '').trim() || phone;

      items.push({ name, phone, contactId });
    }

    return { items, total: items.length };
  }
}
