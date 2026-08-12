import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

export type EvogoSendTextResult = {
  ok: boolean;
  status: number;
  raw: unknown;
  /** Si Evolution devolvió identificador útil en data */
  waMessageId?: string;
};

export type EvogoWebhookConfig = {
  url: string;
  byEvents?: boolean;
  base64?: boolean;
  headers?: Record<string, string>;
  events?: string[];
};

export type EvogoInstanceCreateResult = {
  instanceName: string;
  instanceId: string | null;
  instanceApiKey: string;
  status: string | null;
  qrCode: string | null;
  qrText: string | null;
  pairingCode: string | null;
};

export type EvogoConnectionStateResult = {
  instanceName: string;
  state: string | null;
  wid?: string | null;
};

export type EvogoConnectResult = {
  qrCode: string | null;
  qrText: string | null;
  pairingCode: string | null;
  count: number | null;
};

export type EvogoRemoteInstance = {
  instanceName: string;
  instanceId: string | null;
  instanceApiKey: string | null;
  state: string | null;
  wid: string | null;
  connected: boolean | null;
};

export type EvogoAdvancedSettings = {
  alwaysOnline: boolean;
  rejectCall: boolean;
  readMessages: boolean;
  ignoreGroups: boolean;
  ignoreStatus: boolean;
  msgRejectCall: string;
};

export type EvogoInstanceConfig = {
  instanceId: string | null;
  instanceName: string;
  token: string | null;
  webhookUrl: string | null;
  webhookEvents: string[];
  profileName: string | null;
  number: string | null;
  connected: boolean;
  state: string | null;
  rabbitmqEnable: string | null;
  websocketEnable: string | null;
  natsEnable: string | null;
};

export const EVOGO_WEBHOOK_EVENT_OPTIONS = [
  'ALL',
  'MESSAGE',
  'PRESENCE',
  'CHAT_PRESENCE',
  'CONNECTION',
  'READ_RECEIPT',
  'HISTORY_SYNC',
  'CALL',
  'QRCODE',
  'LABEL',
  'CONTACT',
  'GROUP',
  'NEWSLETTER',
] as const;

@Injectable()
export class EvogoClient {
  private readonly logger = new Logger(EvogoClient.name);
  private readonly defaultWebhookEvents = [
    'MESSAGE',
    'MESSAGES_UPSERT',
    'MESSAGES_SET',
    'RECEIPT',
    'MESSAGES_UPDATE',
    'QRCODE_UPDATED',
    'CONNECTION_UPDATE',
  ];

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    const raw =
      this.config.get<string>('EVOGO_BASE_URL')?.trim() ||
      'https://evogo.taximonterrico.com';
    return raw.replace(/\/$/, '');
  }

  private managerApiKey(): string {
    const key =
      this.config.get<string>('EVOGO_MANAGER_API_KEY')?.trim() ||
      this.config.get<string>('EVOGO_GLOBAL_API_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'Falta EVOGO_MANAGER_API_KEY para gestionar instancias personales de WhatsApp',
      );
    }
    return key;
  }

  private managerApiKeyOrNull(): string | null {
    return (
      this.config.get<string>('EVOGO_MANAGER_API_KEY')?.trim() ||
      this.config.get<string>('EVOGO_GLOBAL_API_KEY')?.trim() ||
      null
    );
  }

  private async requestJsonWithManagerFallback(
    path: string,
    init: RequestInit & {
      apiKey?: string;
    },
  ): Promise<{ status: number; ok: boolean; raw: unknown }> {
    const preferredApiKey = init.apiKey?.trim() || null;
    const res = await this.requestJson(path, init);
    if (res.status !== 401) return res;

    const managerApiKey = this.managerApiKeyOrNull();
    if (!managerApiKey || managerApiKey === preferredApiKey) return res;

    this.logger.warn(
      `Evogo ${init.method ?? 'GET'} ${path} devolvio 401 con token de instancia; reintentando con token manager`,
    );
    return this.requestJson(path, {
      ...init,
      apiKey: managerApiKey,
    });
  }

  private async requestJson(
    path: string,
    init: RequestInit & {
      apiKey?: string;
    },
  ): Promise<{ status: number; ok: boolean; raw: unknown }> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('apikey', init.apiKey?.trim() || this.managerApiKey());
    const res = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers,
    });
    const textBody = await res.text();
    let raw: unknown = null;
    try {
      raw = textBody ? JSON.parse(textBody) : null;
    } catch {
      raw = { rawBody: textBody };
    }
    if (!res.ok) {
      this.logger.warn(
        `Evogo ${init.method ?? 'GET'} ${path} HTTP ${res.status}: ${textBody.slice(0, 500)}`,
      );
    }
    return { status: res.status, ok: res.ok, raw };
  }

  async createInstance(params: {
    instanceName: string;
    webhook: EvogoWebhookConfig;
    token?: string;
  }): Promise<EvogoInstanceCreateResult> {
    const instanceToken = params.token?.trim() || randomUUID();
    const res = await this.requestJson('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        name: params.instanceName,
        instanceName: params.instanceName,
        token: instanceToken,
        webhook: params.webhook.url,
        webhookUrl: params.webhook.url,
        webhookEvents: params.webhook.events ?? this.defaultWebhookEvents,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        rejectCall: true,
        groupsIgnore: true,
        readMessages: false,
        readStatus: true,
        syncFullHistory: false,
      }),
    });
    if (!res.ok) {
      throw new Error(this.readErrorMessage(res.raw, 'No se pudo crear la instancia'));
    }

    const root = this.asRecord(res.raw);
    const data = this.asRecord(root?.data);
    const instance = this.asRecord(root?.instance) ?? data;
    const hash = this.asRecord(root?.hash);
    const qrcode =
      this.asRecord(root?.qrcode) ??
      this.asRecord(root?.qr) ??
      this.asRecord(data?.qrcode) ??
      data;
    const instanceName =
      this.asString(instance?.instanceName) ||
      this.asString(instance?.name) ||
      params.instanceName;
    const instanceApiKey =
      this.asString(hash?.apikey) ||
      this.asString(data?.token) ||
      this.asString(root?.['token']) ||
      instanceToken;
    if (!instanceApiKey) {
      throw new Error('Evolution no devolvió el token de la instancia creada');
    }

    const connected =
      typeof data?.connected === 'boolean' ? data.connected : null;
    return {
      instanceName,
      instanceId:
        this.asString(instance?.instanceId) ||
        this.asString(instance?.id) ||
        null,
      instanceApiKey,
      status:
        this.asString(instance?.status) ||
        (connected === null ? null : connected ? 'open' : 'close'),
      qrCode: this.pickQrBase64(qrcode),
      qrText: this.pickQrText(qrcode),
      pairingCode: this.asString(qrcode?.pairingCode) || null,
    };
  }

  async connectInstance(params: {
    instanceName: string;
    instanceApiKey?: string;
    webhookUrl?: string;
  }): Promise<EvogoConnectResult> {
    const connectRes = await this.requestJsonWithManagerFallback('/instance/connect', {
      method: 'POST',
      apiKey: params.instanceApiKey,
      body: JSON.stringify({
        instanceName: params.instanceName,
        name: params.instanceName,
        instance: params.instanceName,
        webhookUrl: params.webhookUrl,
        subscribe: this.defaultWebhookEvents,
      }),
    });
    let res = connectRes;
    let parsed = this.parseConnectQr(connectRes.raw);
    const connectLooksLikeQr = Boolean(parsed.qrCode || parsed.qrText);
    if (connectRes.ok && !connectLooksLikeQr) {
      for (let attempt = 0; attempt < 6; attempt++) {
        res = await this.requestJsonWithManagerFallback('/instance/qr', {
          method: 'GET',
          apiKey: params.instanceApiKey,
        });
        if (res.ok) {
          parsed = this.parseConnectQr(res.raw);
          if (parsed.qrCode || parsed.qrText) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } else if (!res.ok) {
      res = await this.requestJsonWithManagerFallback(
        `/instance/connect/${encodeURIComponent(params.instanceName)}`,
        {
          method: 'GET',
          apiKey: params.instanceApiKey,
        },
      );
    }
    if (!res.ok) {
      res = await this.requestJsonWithManagerFallback('/instance/qr', {
        method: 'GET',
        apiKey: params.instanceApiKey,
      });
    }
    if (!res.ok) {
      res = await this.requestJsonWithManagerFallback(
        `/instance/${encodeURIComponent(params.instanceName)}/qrcode`,
        {
          method: 'GET',
          apiKey: params.instanceApiKey,
        },
      );
    }
    if (!res.ok) {
      throw new Error(this.readErrorMessage(res.raw, 'No se pudo generar el QR'));
    }
    parsed = this.parseConnectQr(res.raw);
    return parsed;
  }

  async connectionState(params: {
    instanceName: string;
    instanceApiKey?: string;
  }): Promise<EvogoConnectionStateResult> {
    let res = await this.requestJsonWithManagerFallback('/instance/status', {
      method: 'GET',
      apiKey: params.instanceApiKey,
    });
    if (!res.ok) {
      res = await this.requestJsonWithManagerFallback(
        `/instance/connectionState/${encodeURIComponent(params.instanceName)}`,
        {
          method: 'GET',
          apiKey: params.instanceApiKey,
        },
      );
    }
    const listInstances = async () => {
      try {
        const all = await this.listAllInstances();
        const match = all.find((item) => item.instanceName === params.instanceName);
        if (match) {
          return {
            instanceName: match.instanceName,
            state: match.state,
            connected: match.connected,
            wid: match.wid,
          };
        }
        return null;
      } catch {
        return undefined;
      }
    };

    let parsed = res.ok ? this.readConnectionNode(res.raw) : null;
    if (res.ok) {
      if (Array.isArray(res.raw)) {
        const match = res.raw.find(
          (item) => this.readConnectionNode(item).instanceName === params.instanceName,
        );
        if (match) parsed = this.readConnectionNode(match);
      } else {
        const root = this.asRecord(res.raw);
        const dataArray = Array.isArray(root?.data)
          ? root.data
          : Array.isArray(root?.Data)
            ? root.Data
            : null;
        if (dataArray) {
          const match = dataArray.find(
            (item) => this.readConnectionNode(item).instanceName === params.instanceName,
          );
          if (match) parsed = this.readConnectionNode(match);
        }
      }
    }

    const listed = await listInstances();
    if (listed === null) {
      throw new Error(`Instance not found: ${params.instanceName}`);
    }
    if (!parsed && listed !== undefined) {
      parsed = listed;
    }
    if (listed && listed.connected !== null) {
      parsed = listed;
    }
    if (!parsed) {
      throw new Error(
        this.readErrorMessage(res.raw, 'No se pudo consultar el estado de conexión'),
      );
    }

    return {
      instanceName: parsed.instanceName || params.instanceName,
      state: parsed.state,
      wid: parsed.wid || undefined,
    };
  }

  async logoutInstance(params: {
    instanceName: string;
    instanceApiKey?: string;
  }): Promise<void> {
    const bodyWithName = JSON.stringify({
      instanceName: params.instanceName,
      name: params.instanceName,
      instance: params.instanceName,
    });
    const attempts: Array<{
      path: string;
      method: 'DELETE' | 'POST';
      apiKey?: string;
      body?: string;
      label: string;
    }> = [
      {
        path: '/instance/logout',
        method: 'DELETE',
        apiKey: params.instanceApiKey,
        label: 'DELETE /instance/logout con token de instancia',
      },
      {
        path: '/instance/logout',
        method: 'POST',
        apiKey: params.instanceApiKey,
        body: bodyWithName,
        label: 'POST /instance/logout con body y token de instancia',
      },
      {
        path: '/instance/logout',
        method: 'POST',
        body: bodyWithName,
        label: 'POST /instance/logout con body y token manager',
      },
    ];

    let lastError = 'No se pudo desconectar la instancia';
    for (const attempt of attempts) {
      const res = await this.requestJson(attempt.path, {
        method: attempt.method,
        apiKey: attempt.apiKey,
        body: attempt.body,
      });
      if (res.ok) {
        return;
      }
      lastError = this.readErrorMessage(res.raw, lastError);
      this.logger.warn(
        `Logout fallback fallido (${attempt.label}) para ${params.instanceName}: HTTP ${res.status}`,
      );
    }

    try {
      const state = await this.connectionState({
        instanceName: params.instanceName,
        instanceApiKey: params.instanceApiKey,
      });
      if (this.isDisconnectedState(state.state)) {
        return;
      }
    } catch {
      // Si no podemos verificar estado, devolvemos el ultimo error conocido.
    }

    throw new Error(lastError);
  }

  async listAllInstances(): Promise<EvogoRemoteInstance[]> {
    const attempts = ['/instance/all', '/instance/fetchInstances'];
    for (const path of attempts) {
      const listRes = await this.requestJson(path, { method: 'GET' });
      if (!listRes.ok) continue;
      const candidates = this.extractInstanceArray(listRes.raw);
      if (candidates.length === 0) continue;
      return candidates
        .map((item) => this.readRemoteInstanceNode(item))
        .filter((item) => Boolean(item.instanceName));
    }
    return [];
  }

  async findRemoteInstance(instanceName: string): Promise<EvogoRemoteInstance | null> {
    const normalized = instanceName.trim().toLowerCase();
    if (!normalized) return null;
    const all = await this.listAllInstances();
    return (
      all.find((item) => item.instanceName.trim().toLowerCase() === normalized) ?? null
    );
  }

  async disconnectInstance(params: {
    instanceName: string;
    instanceApiKey?: string;
  }): Promise<void> {
    const body = JSON.stringify({
      instanceName: params.instanceName,
      name: params.instanceName,
      instance: params.instanceName,
    });
    const attempts: Array<{ path: string; method: 'POST' | 'DELETE'; body?: string; apiKey?: string }> = [
      { path: '/instance/disconnect', method: 'POST', body, apiKey: params.instanceApiKey },
      { path: '/instance/disconnect', method: 'POST', body },
    ];
    for (const attempt of attempts) {
      const res = await this.requestJson(attempt.path, {
        method: attempt.method,
        apiKey: attempt.apiKey,
        body: attempt.body,
      });
      if (res.ok) return;
    }
    await this.logoutInstance(params);
  }

  async deleteRemoteInstance(params: {
    instanceName: string;
    instanceId?: string | null;
    instanceApiKey?: string;
  }): Promise<void> {
    let instanceId = params.instanceId?.trim() || null;
    if (!instanceId) {
      const remote = await this.findRemoteInstance(params.instanceName);
      instanceId = remote?.instanceId ?? null;
    }

    if (instanceId) {
      const res = await this.requestJson(
        `/instance/delete/${encodeURIComponent(instanceId)}`,
        { method: 'DELETE', apiKey: params.instanceApiKey },
      );
      if (res.ok) return;
      this.logger.warn(
        `Evogo delete ${params.instanceName} HTTP ${res.status}: ${this.readErrorMessage(res.raw, 'delete failed')}`,
      );
    }

    try {
      await this.disconnectInstance({
        instanceName: params.instanceName,
        instanceApiKey: params.instanceApiKey,
      });
    } catch (e) {
      this.logger.warn(
        `Evogo delete fallback disconnect for ${params.instanceName}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  async forceReconnectInstance(params: {
    instanceName: string;
    instanceId?: string | null;
    instanceApiKey?: string;
    webhookUrl?: string;
  }): Promise<EvogoConnectResult> {
    let instanceId = params.instanceId?.trim() || null;
    if (!instanceId) {
      const remote = await this.findRemoteInstance(params.instanceName);
      instanceId = remote?.instanceId ?? null;
    }

    if (instanceId) {
      const res = await this.requestJsonWithManagerFallback(
        `/instance/forcereconnect/${encodeURIComponent(instanceId)}`,
        {
          method: 'POST',
          apiKey: params.instanceApiKey,
          body: JSON.stringify({
            instanceName: params.instanceName,
            name: params.instanceName,
            instance: params.instanceName,
            webhookUrl: params.webhookUrl,
          }),
        },
      );
      if (res.ok) {
        const parsed = this.parseConnectQr(res.raw);
        if (parsed.qrCode || parsed.qrText) return parsed;
      }
    }

    const reconnectRes = await this.requestJsonWithManagerFallback('/instance/reconnect', {
      method: 'POST',
      apiKey: params.instanceApiKey,
      body: JSON.stringify({
        instanceName: params.instanceName,
        name: params.instanceName,
        instance: params.instanceName,
        webhookUrl: params.webhookUrl,
      }),
    });
    if (reconnectRes.ok) {
      const parsed = this.parseConnectQr(reconnectRes.raw);
      if (parsed.qrCode || parsed.qrText) return parsed;
    }

    return this.connectInstance({
      instanceName: params.instanceName,
      instanceApiKey: params.instanceApiKey,
      webhookUrl: params.webhookUrl,
    });
  }

  async getInstanceInfo(params: {
    instanceId: string;
    instanceApiKey?: string;
  }): Promise<EvogoInstanceConfig> {
    const res = await this.requestJsonWithManagerFallback(
      `/instance/info/${encodeURIComponent(params.instanceId)}`,
      { method: 'GET', apiKey: params.instanceApiKey },
    );
    if (!res.ok) {
      throw new Error(this.readErrorMessage(res.raw, 'No se pudo obtener la instancia'));
    }
    return this.parseInstanceConfig(res.raw);
  }

  async getAdvancedSettings(params: {
    instanceId: string;
    instanceApiKey?: string;
  }): Promise<EvogoAdvancedSettings> {
    const res = await this.requestJsonWithManagerFallback(
      `/instance/${encodeURIComponent(params.instanceId)}/advanced-settings`,
      { method: 'GET', apiKey: params.instanceApiKey },
    );
    if (!res.ok) {
      return {
        alwaysOnline: false,
        rejectCall: true,
        readMessages: false,
        ignoreGroups: true,
        ignoreStatus: false,
        msgRejectCall: '',
      };
    }
    return this.parseAdvancedSettings(res.raw);
  }

  async updateAdvancedSettings(params: {
    instanceId: string;
    instanceApiKey?: string;
    settings: EvogoAdvancedSettings;
  }): Promise<void> {
    const res = await this.requestJsonWithManagerFallback(
      `/instance/${encodeURIComponent(params.instanceId)}/advanced-settings`,
      {
        method: 'PUT',
        apiKey: params.instanceApiKey,
        body: JSON.stringify(params.settings),
      },
    );
    if (!res.ok) {
      throw new Error(this.readErrorMessage(res.raw, 'No se pudieron guardar las opciones avanzadas'));
    }
  }

  async updateInstanceWebhook(params: {
    instanceName: string;
    instanceApiKey?: string;
    webhookUrl: string;
    events: string[];
    rabbitmqEnable?: string;
    websocketEnable?: string;
    natsEnable?: string;
  }): Promise<void> {
    const subscribe = this.normalizeWebhookEvents(params.events);
    const res = await this.requestJsonWithManagerFallback('/instance/connect', {
      method: 'POST',
      apiKey: params.instanceApiKey,
      body: JSON.stringify({
        instanceName: params.instanceName,
        name: params.instanceName,
        instance: params.instanceName,
        webhookUrl: params.webhookUrl,
        subscribe,
        rabbitmqEnable: params.rabbitmqEnable || 'Padrão',
        websocketEnable: params.websocketEnable || 'Padrão',
        natsEnable: params.natsEnable || 'Padrão',
      }),
    });
    if (!res.ok) {
      throw new Error(this.readErrorMessage(res.raw, 'No se pudo guardar el webhook'));
    }
  }

  /**
   * Evolution GO autentica rutas de instancia con el header `apikey`
   * igual al **token de la instancia** (no la GLOBAL_API_KEY).
   */
  async sendText(params: {
    instanceApiKey: string;
    number: string;
    text: string;
  }): Promise<EvogoSendTextResult> {
    const res = await this.requestJsonWithManagerFallback('/send/text', {
      method: 'POST',
      apiKey: params.instanceApiKey,
      body: JSON.stringify({
        number: params.number,
        text: params.text,
      }),
    });

    if (!res.ok) {
      this.logger.warn(`Evogo sendText HTTP ${res.status}: ${JSON.stringify(res.raw)?.slice(0, 500)}`);
      return { ok: false, status: res.status, raw: res.raw };
    }

    const waMessageId = this.tryExtractMessageId(res.raw);
    return { ok: true, status: res.status, raw: res.raw, waMessageId };
  }

  async sendMedia(params: {
    instanceApiKey: string;
    number: string;
    mediaUrl: string;
    mediatype?: string;
    caption?: string;
    mimeType?: string;
    fileName?: string;
  }): Promise<EvogoSendTextResult> {
    const body: Record<string, unknown> = {
      number: params.number,
      type: params.mediatype || 'image',
      url: params.mediaUrl,
    };
    if (params.caption) {
      body.caption = params.caption;
    }
    if (params.mimeType) {
      body.mimeType = params.mimeType;
    }
    if (params.fileName) {
      body.fileName = params.fileName;
    }
    const res = await this.requestJsonWithManagerFallback('/send/media', {
      method: 'POST',
      apiKey: params.instanceApiKey,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      this.logger.warn(`Evogo sendMedia HTTP ${res.status}: ${JSON.stringify(res.raw)?.slice(0, 500)}`);
      return { ok: false, status: res.status, raw: res.raw };
    }

    const waMessageId = this.tryExtractMessageId(res.raw);
    return { ok: true, status: res.status, raw: res.raw, waMessageId };
  }

  async deleteMessage(params: {
    instanceApiKey: string;
    waMessageId: string;
    chat: string;
  }): Promise<EvogoSendTextResult> {
    const res = await this.requestJsonWithManagerFallback('/message/delete', {
      method: 'POST',
      apiKey: params.instanceApiKey,
      body: JSON.stringify({ messageId: params.waMessageId, chat: params.chat }),
    });
    if (!res.ok) {
      this.logger.warn(`Evogo deleteMessage HTTP ${res.status}: ${JSON.stringify(res.raw)?.slice(0, 500)}`);
    }
    return { ok: res.ok, status: res.status, raw: res.raw };
  }

  /** Guarda/renombra contacto en la agenda de WhatsApp (Evolution API). */
  async saveContact(params: {
    instanceApiKey: string;
    number: string;
    name: string;
    saveOnDevice?: boolean;
  }): Promise<EvogoSendTextResult> {
    const body = JSON.stringify({
      number: params.number,
      name: params.name,
      saveOnDevice: params.saveOnDevice ?? true,
    });
    const paths = ['/chat/saveContact', '/contact/save', '/chat/contact/save'];
    let last: EvogoSendTextResult = { ok: false, status: 0, raw: null };
    for (const path of paths) {
      const res = await this.requestJsonWithManagerFallback(path, {
        method: 'POST',
        apiKey: params.instanceApiKey,
        body,
      });
      last = { ok: res.ok, status: res.status, raw: res.raw };
      if (res.ok) return last;
    }
    this.logger.warn(
      `Evogo saveContact falló para ${params.number}: HTTP ${last.status}: ${JSON.stringify(last.raw)?.slice(0, 300)}`,
    );
    return last;
  }

  async downloadMedia(params: {
    instanceApiKey: string;
    message: Record<string, unknown>;
  }): Promise<Buffer | null> {
    const preferredApiKey = params.instanceApiKey.trim() || null;
    const body = JSON.stringify({ message: params.message });
    const url = `${this.baseUrl()}/message/downloadimage/${params.instanceApiKey}`;

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: preferredApiKey || '' },
      body,
    });

    if (response.status === 401) {
      const managerApiKey = this.managerApiKeyOrNull();
      if (managerApiKey && managerApiKey !== preferredApiKey) {
        this.logger.warn('Evogo downloadMedia: reintentando con token manager');
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: managerApiKey || '' },
          body,
        });
      }
    }

    if (!response.ok) {
      this.logger.warn(`Evogo downloadMedia HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const json = await response.json() as Record<string, unknown>;
        const b64 = json['data'] ?? json['base64'] ?? json['media'];
        if (typeof b64 === 'string' && b64.length > 0) {
          return Buffer.from(b64, 'base64');
        }
      } catch { /* seguir con binario */ }
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > 0) return Buffer.from(arrayBuffer);
    return null;
  }

  private tryExtractMessageId(raw: unknown): string | undefined {
    const o = raw as Record<string, unknown> | null;
    const data = o?.['data'];
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      const info = d['Info'] ?? d['info'];
      if (info && typeof info === 'object') {
        const id = (info as Record<string, unknown>)['ID'] ??
          (info as Record<string, unknown>)['Id'];
        if (typeof id === 'string') return id;
      }
    }
    return undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private isDisconnectedState(state: string | null | undefined): boolean {
    const normalized = (state || '').trim().toLowerCase();
    return [
      'close',
      'closed',
      'disconnected',
      'disconnect',
      'logged_out',
      'logout',
      'offline',
    ].includes(normalized);
  }

  private parseAdvancedSettings(raw: unknown): EvogoAdvancedSettings {
    const root = this.asRecord(raw);
    const data = this.asRecord(root?.data) ?? root;
    return {
      alwaysOnline: data?.alwaysOnline === true,
      rejectCall: data?.rejectCall !== false,
      readMessages: data?.readMessages === true,
      ignoreGroups: data?.ignoreGroups === true,
      ignoreStatus: data?.ignoreStatus === true,
      msgRejectCall: this.asString(data?.msgRejectCall) || '',
    };
  }

  private parseInstanceConfig(raw: unknown): EvogoInstanceConfig {
    const root = this.asRecord(raw);
    const data = this.asRecord(root?.data) ?? root;
    const conn = this.readConnectionNode(raw);
    const eventsRaw =
      data?.webhookEvents ??
      data?.WebhookEvents ??
      data?.subscribe ??
      data?.events ??
      root?.webhookEvents ??
      root?.subscribe;
    const webhookEvents = Array.isArray(eventsRaw)
      ? eventsRaw.filter((item): item is string => typeof item === 'string')
      : typeof eventsRaw === 'string'
        ? eventsRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    return {
      instanceId:
        this.asString(data?.id) ||
        this.asString(data?.instanceId) ||
        this.asString(root?.id) ||
        null,
      instanceName: conn.instanceName || this.asString(data?.name) || '',
      token:
        this.asString(data?.token) ||
        this.asString(this.asRecord(data?.hash)?.apikey) ||
        this.asString(root?.token) ||
        null,
      webhookUrl:
        this.asString(data?.webhookUrl) ||
        this.asString(data?.webhook) ||
        this.asString(root?.webhookUrl) ||
        null,
      webhookEvents,
      profileName:
        this.asString(data?.profileName) ||
        this.asString(data?.pushName) ||
        conn.instanceName,
      number: conn.wid,
      connected: conn.connected === true || this.normalizeConnectionState(conn.state) === 'open',
      state: conn.state,
      rabbitmqEnable: this.asString(data?.rabbitmqEnable),
      websocketEnable: this.asString(data?.websocketEnable),
      natsEnable: this.asString(data?.natsEnable),
    };
  }

  private normalizeWebhookEvents(events: string[]): string[] {
    const normalized = events
      .map((event) => event.trim().toUpperCase())
      .filter(Boolean);
    if (normalized.includes('ALL')) {
      return [...this.defaultWebhookEvents, 'ALL'];
    }
    const expanded = new Set<string>(normalized);
    if (expanded.has('MESSAGE')) {
      expanded.add('MESSAGES_UPSERT');
      expanded.add('MESSAGES_SET');
    }
    if (expanded.has('CONNECTION')) {
      expanded.add('CONNECTION_UPDATE');
    }
    if (expanded.has('QRCODE')) {
      expanded.add('QRCODE_UPDATED');
    }
    if (expanded.has('READ_RECEIPT')) {
      expanded.add('RECEIPT');
      expanded.add('MESSAGES_UPDATE');
    }
    return [...expanded];
  }

  private normalizeConnectionState(state: string | null | undefined): string {
    const s = (state || '').trim().toLowerCase();
    if (s.includes('open') || s.includes('connected')) return 'open';
    if (s.includes('connect')) return 'connecting';
    if (s.includes('close') || s.includes('disconnect')) return 'close';
    if (s.includes('qr')) return 'qr_ready';
    return s || 'pending';
  }

  private extractInstanceArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    const root = this.asRecord(raw);
    if (Array.isArray(root?.data)) return root.data as unknown[];
    if (Array.isArray(root?.Data)) return root.Data as unknown[];
    if (Array.isArray(root?.instances)) return root.instances as unknown[];
    return [];
  }

  private readRemoteInstanceNode(node: unknown): EvogoRemoteInstance {
    const conn = this.readConnectionNode(node);
    const root = this.asRecord(node);
    const instance = this.asRecord(root?.instance) ?? this.asRecord(root?.Instance);
    const data = this.asRecord(root?.data) ?? this.asRecord(root?.Data);
    const hash = this.asRecord(root?.hash) ?? this.asRecord(data?.hash);
    const instanceId =
      this.asString(root?.id) ||
      this.asString(root?.instanceId) ||
      this.asString(instance?.id) ||
      this.asString(instance?.instanceId) ||
      this.asString(data?.id) ||
      this.asString(data?.instanceId) ||
      null;
    const instanceApiKey =
      this.asString(hash?.apikey) ||
      this.asString(root?.token) ||
      this.asString(data?.token) ||
      this.asString(instance?.token) ||
      null;
    return {
      instanceName: conn.instanceName || '',
      instanceId,
      instanceApiKey,
      state: conn.state,
      wid: conn.wid,
      connected: conn.connected,
    };
  }

  private parseConnectQr(raw: unknown): EvogoConnectResult {
    const root = this.asRecord(raw);
    const data = this.asRecord(root?.data);
    const qrcode =
      this.asRecord(root?.qrcode) ??
      this.asRecord(root?.qr) ??
      this.asRecord(data?.qrcode) ??
      data ??
      root;
    return {
      qrCode: this.pickQrBase64(qrcode),
      qrText: this.pickQrText(qrcode),
      pairingCode: this.asString(qrcode?.pairingCode) || null,
      count:
        typeof qrcode?.count === 'number'
          ? qrcode.count
          : typeof data?.count === 'number'
            ? data.count
            : null,
    };
  }

  private readConnectionNode(node: unknown): {
    instanceName: string | null;
    state: string | null;
    connected: boolean | null;
    wid: string | null;
  } {
    const root = this.asRecord(node);
    const instance = this.asRecord(root?.instance);
    const instanceUpper = this.asRecord(root?.Instance);
    const data = this.asRecord(root?.data);
    const dataUpper = this.asRecord(root?.Data);
    const dataInstance = this.asRecord(data?.instance);
    const dataInstanceUpper = this.asRecord(dataUpper?.Instance);

    const instanceName =
      this.asString(instance?.instanceName) ||
      this.asString(instance?.name) ||
      this.asString(instanceUpper?.instanceName) ||
      this.asString(instanceUpper?.name) ||
      this.asString(dataInstance?.instanceName) ||
      this.asString(dataInstance?.name) ||
      this.asString(dataInstanceUpper?.instanceName) ||
      this.asString(dataInstanceUpper?.name) ||
      this.asString(data?.name) ||
      this.asString(dataUpper?.name) ||
      this.asString(root?.instanceName) ||
      this.asString(root?.name) ||
      null;

    const connectedCandidates = [
      data?.connected,
      dataUpper?.connected,
      dataInstance?.connected,
      dataInstanceUpper?.connected,
      instance?.connected,
      instanceUpper?.connected,
      root?.connected,
    ];

    const connected =
      connectedCandidates.find(
        (candidate): candidate is boolean => typeof candidate === 'boolean',
      ) ?? null;

    const state =
      this.asString(instance?.state) ||
      this.asString(instanceUpper?.state) ||
      this.asString(dataInstance?.state) ||
      this.asString(dataInstanceUpper?.state) ||
      this.asString(data?.state) ||
      this.asString(dataUpper?.state) ||
      this.asString(root?.state) ||
      this.asString(root?.status) ||
      (connected !== null ? (connected ? 'open' : 'close') : null);

    const rawWid =
      this.asString(root?.jid) ||
      this.asString(root?.Jid) ||
      this.asString(root?.wid) ||
      this.asString(root?.Wid) ||
      null;

    const wid = rawWid ? rawWid.split('@')[0]?.replace(/:\d+$/, '') || null : null;

    return { instanceName, state, connected, wid };
  }

  private pickQrBase64(qrcode: Record<string, unknown> | null): string | null {
    const candidates = [
      this.asString(qrcode?.base64),
      this.asString(qrcode?.Base64),
      this.asString(qrcode?.code),
      this.asString(qrcode?.Code),
      this.asString(qrcode?.qr),
      this.asString(qrcode?.Qr),
      this.asString(qrcode?.qrcode),
      this.asString(qrcode?.Qrcode),
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (
        candidate.startsWith('data:image/') ||
        /^[A-Za-z0-9+/=]+$/.test(candidate.slice(0, 120))
      ) {
        return candidate;
      }
    }
    return null;
  }

  private pickQrText(qrcode: Record<string, unknown> | null): string | null {
    const codeText = this.asString(qrcode?.code);
    if (codeText && !codeText.startsWith('data:image/')) {
      return codeText;
    }
    const codeTextUpper = this.asString(qrcode?.Code);
    if (codeTextUpper && !codeTextUpper.startsWith('data:image/')) {
      return codeTextUpper;
    }
    const qrcodeText = this.asString(qrcode?.qrcode);
    if (qrcodeText && !qrcodeText.startsWith('data:image/')) {
      return qrcodeText;
    }
    const qrcodeTextUpper = this.asString(qrcode?.Qrcode);
    if (qrcodeTextUpper && !qrcodeTextUpper.startsWith('data:image/')) {
      return qrcodeTextUpper;
    }
    const qrText = this.asString(qrcode?.qr);
    if (qrText && !qrText.startsWith('data:image/')) {
      return qrText;
    }
    const qrTextUpper = this.asString(qrcode?.Qr);
    if (qrTextUpper && !qrTextUpper.startsWith('data:image/')) {
      return qrTextUpper;
    }
    return null;
  }

  private readErrorMessage(raw: unknown, fallback: string): string {
    const root = this.asRecord(raw);
    const response = this.asRecord(root?.response);
    const nestedError = this.asRecord(root?.error);
    const message =
      response?.message ??
      nestedError?.message ??
      root?.message ??
      root?.error;
    if (Array.isArray(message)) {
      const first = message.find((v) => typeof v === 'string');
      if (typeof first === 'string') return first;
    }
    if (typeof message === 'string' && message.trim()) return message;
    return fallback;
  }
}
