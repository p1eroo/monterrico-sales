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
};

export type EvogoConnectResult = {
  qrCode: string | null;
  qrText: string | null;
  pairingCode: string | null;
  count: number | null;
};

@Injectable()
export class EvogoClient {
  private readonly logger = new Logger(EvogoClient.name);

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
  }): Promise<EvogoInstanceCreateResult> {
    const instanceToken = randomUUID();
    const res = await this.requestJson('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        name: params.instanceName,
        instanceName: params.instanceName,
        token: instanceToken,
        webhook: params.webhook.url,
        webhookUrl: params.webhook.url,
        webhookEvents: params.webhook.events ?? [
          'MESSAGE',
          'RECEIPT',
          'MESSAGES_UPDATE',
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
        ],
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
    const parseQr = (raw: unknown): EvogoConnectResult => {
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
    };

    const connectRes = await this.requestJson('/instance/connect', {
      method: 'POST',
      apiKey: params.instanceApiKey,
      body: JSON.stringify({
        webhookUrl: params.webhookUrl,
        subscribe: [
          'MESSAGE',
          'RECEIPT',
          'MESSAGES_UPDATE',
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
        ],
      }),
    });
    let res = connectRes;
    let parsed = parseQr(connectRes.raw);
    const connectLooksLikeQr = Boolean(parsed.qrCode || parsed.qrText);
    if (connectRes.ok && !connectLooksLikeQr) {
      for (let attempt = 0; attempt < 6; attempt++) {
        res = await this.requestJson('/instance/qr', {
          method: 'GET',
          apiKey: params.instanceApiKey,
        });
        if (res.ok) {
          parsed = parseQr(res.raw);
          if (parsed.qrCode || parsed.qrText) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } else if (!res.ok) {
      res = await this.requestJson(
        `/instance/connect/${encodeURIComponent(params.instanceName)}`,
        {
          method: 'GET',
          apiKey: params.instanceApiKey,
        },
      );
    }
    if (!res.ok) {
      res = await this.requestJson('/instance/qr', {
        method: 'GET',
        apiKey: params.instanceApiKey,
      });
    }
    if (!res.ok) {
      res = await this.requestJson(
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
    parsed = parseQr(res.raw);
    return parsed;
  }

  async connectionState(params: {
    instanceName: string;
    instanceApiKey?: string;
  }): Promise<EvogoConnectionStateResult> {
    let res = await this.requestJson(
      `/instance/connectionState/${encodeURIComponent(params.instanceName)}`,
      {
        method: 'GET',
        apiKey: params.instanceApiKey,
      },
    );
    if (!res.ok) {
      res = await this.requestJson('/instance/status', {
        method: 'GET',
        apiKey: params.instanceApiKey,
      });
    }
    if (!res.ok) {
      throw new Error(
        this.readErrorMessage(res.raw, 'No se pudo consultar el estado de conexión'),
      );
    }
    const readNode = (node: unknown) => {
      const root = this.asRecord(node);
      const instance = this.asRecord(root?.instance);
      const instanceUpper = this.asRecord(root?.Instance);
      const data = this.asRecord(root?.data);
      const dataUpper = this.asRecord(root?.Data);
      const dataInstance = this.asRecord(data?.instance);
      const dataInstanceUpper = this.asRecord(dataUpper?.Instance);
      const connected =
        typeof data?.connected === 'boolean'
          ? data.connected
          : typeof dataUpper?.connected === 'boolean'
            ? dataUpper.connected
            : typeof dataInstance?.connected === 'boolean'
              ? dataInstance.connected
              : typeof dataInstanceUpper?.connected === 'boolean'
                ? dataInstanceUpper.connected
                : typeof root?.connected === 'boolean'
                  ? root.connected
                  : null;
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
      const state =
        this.asString(instance?.state) ||
        this.asString(instance?.status) ||
        this.asString(instance?.connectionStatus) ||
        this.asString(instanceUpper?.state) ||
        this.asString(instanceUpper?.status) ||
        this.asString(instanceUpper?.connectionStatus) ||
        this.asString(dataInstance?.state) ||
        this.asString(dataInstance?.status) ||
        this.asString(dataInstance?.connectionStatus) ||
        this.asString(dataInstanceUpper?.state) ||
        this.asString(dataInstanceUpper?.status) ||
        this.asString(dataInstanceUpper?.connectionStatus) ||
        this.asString(data?.state) ||
        this.asString(data?.status) ||
        this.asString(data?.connectionStatus) ||
        this.asString(dataUpper?.state) ||
        this.asString(dataUpper?.status) ||
        this.asString(dataUpper?.connectionStatus) ||
        this.asString(root?.state) ||
        this.asString(root?.status) ||
        this.asString(root?.connectionStatus) ||
        (connected === null ? null : connected ? 'open' : 'close');
      return { instanceName, state };
    };

    let parsed = readNode(res.raw);
    if (Array.isArray(res.raw)) {
      const match = res.raw.find((item) => {
        const candidate = readNode(item);
        return candidate.instanceName === params.instanceName;
      });
      if (match) parsed = readNode(match);
    } else {
      const root = this.asRecord(res.raw);
      const dataArray = Array.isArray(root?.data) ? root.data : Array.isArray(root?.Data) ? root.Data : null;
      if (dataArray) {
        const match = dataArray.find((item) => {
          const candidate = readNode(item);
          return candidate.instanceName === params.instanceName;
        });
        if (match) parsed = readNode(match);
      }
    }
    return {
      instanceName: parsed.instanceName || params.instanceName,
      state: parsed.state,
    };
  }

  async logoutInstance(params: {
    instanceName: string;
    instanceApiKey?: string;
  }): Promise<void> {
    const res = await this.requestJson(
      `/instance/logout/${encodeURIComponent(params.instanceName)}`,
      {
        method: 'DELETE',
        apiKey: params.instanceApiKey,
      },
    );
    if (!res.ok) {
      throw new Error(
        this.readErrorMessage(res.raw, 'No se pudo desconectar la instancia'),
      );
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
    const url = `${this.baseUrl()}/send/text`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: params.instanceApiKey,
      },
      body: JSON.stringify({
        number: params.number,
        text: params.text,
      }),
    });

    let raw: unknown = null;
    const textBody = await res.text();
    try {
      raw = textBody ? JSON.parse(textBody) : null;
    } catch {
      raw = { rawBody: textBody };
    }

    if (!res.ok) {
      this.logger.warn(`Evogo sendText HTTP ${res.status}: ${textBody.slice(0, 500)}`);
      return { ok: false, status: res.status, raw };
    }

    const waMessageId = this.tryExtractMessageId(raw);
    return { ok: true, status: res.status, raw, waMessageId };
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
