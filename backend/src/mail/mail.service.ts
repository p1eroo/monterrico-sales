import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
// SMTP (HestiaCP) — desactivado mientras se prueba Resend.
// import * as nodemailer from 'nodemailer';
// import type { Transporter } from 'nodemailer';

export type MailAttachmentInput = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type ResendStoredAttachment = {
  id: string;
  filename?: string;
  contentType?: string;
  contentDisposition?: string;
  contentId?: string;
  size?: number;
  downloadUrl?: string;
};

const DEFAULT_FROM = 'Taxi Monterrico <monterrico@taximonterrico.info>';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  // private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('RESEND_API_KEY')?.trim());
  }

  /** @deprecated Usar isConfigured(). Alias mientras campañas migra de SMTP a Resend. */
  isSmtpConfigured(): boolean {
    return this.isConfigured();
  }

  private getResend(): Resend {
    if (this.resend) {
      return this.resend;
    }
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Resend no configurado. Define RESEND_API_KEY en el entorno.',
      );
    }
    this.resend = new Resend(apiKey);
    return this.resend;
  }

  client(): Resend {
    return this.getResend();
  }

  webhookSecret(): string {
    return this.config.get<string>('RESEND_WEBHOOK_SECRET')?.trim() ?? '';
  }

  verifyWebhook(params: {
    payload: string;
    headers: { id?: string; timestamp?: string; signature?: string };
  }): unknown {
    const webhookSecret = this.webhookSecret();
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Resend webhook no configurado. Define RESEND_WEBHOOK_SECRET.',
      );
    }
    return this.getResend().webhooks.verify({
      payload: params.payload,
      headers: {
        id: params.headers.id ?? '',
        timestamp: params.headers.timestamp ?? '',
        signature: params.headers.signature ?? '',
      },
      webhookSecret,
    });
  }

  fromAddress(): string {
    return this.getFromAddress();
  }

  private getFromAddress(): string {
    const from = this.config.get<string>('RESEND_FROM')?.trim();
    return from && from.length > 0 ? from : DEFAULT_FROM;
  }

  private apiKey(): string {
    return this.config.get<string>('RESEND_API_KEY')?.trim() ?? '';
  }

  /**
   * Envía un correo HTML vía Resend.
   * El remitente debe pertenecer al dominio verificado (taximonterrico.info, sa-east-1).
   */
  async sendHtmlEmail(params: {
    to: string;
    subject: string;
    html: string;
    attachments?: MailAttachmentInput[];
    tags?: { name: string; value: string }[];
    headers?: Record<string, string>;
  }): Promise<{ id: string }> {
    try {
      const { data, error } = await this.getResend().emails.send({
        from: this.getFromAddress(),
        to: [params.to],
        subject: params.subject,
        html: params.html,
        attachments: params.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          ...(a.contentType ? { contentType: a.contentType } : {}),
        })),
        ...(params.tags?.length ? { tags: params.tags } : {}),
        ...(params.headers && Object.keys(params.headers).length
          ? { headers: params.headers }
          : {}),
      });
      if (error) {
        throw new Error(error.message || JSON.stringify(error));
      }
      const id = data?.id?.trim();
      if (!id) {
        throw new Error('Resend no devolvió id de envío');
      }
      this.logger.log(`Correo enviado vía Resend a ${params.to} (${id})`);
      return { id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Fallo Resend para ${params.to}: ${msg}`);
      throw err;
    }
  }

  async listReceivingAttachments(
    emailId: string,
  ): Promise<ResendStoredAttachment[]> {
    return this.listAttachmentsJson(
      `/emails/receiving/${encodeURIComponent(emailId)}/attachments`,
    );
  }

  async getReceivingAttachment(
    emailId: string,
    attachmentId: string,
  ): Promise<ResendStoredAttachment | null> {
    const rec = await this.getJson(
      `/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
    return rec ? this.parseStoredAttachment(rec) : null;
  }

  async listSentAttachments(emailId: string): Promise<ResendStoredAttachment[]> {
    return this.listAttachmentsJson(
      `/emails/${encodeURIComponent(emailId)}/attachments`,
    );
  }

  async downloadFromUrl(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`No se pudo descargar el adjunto (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  private async resendFetch(path: string): Promise<Response> {
    const key = this.apiKey();
    if (!key) {
      throw new ServiceUnavailableException(
        'Resend no configurado. Define RESEND_API_KEY en el entorno.',
      );
    }
    return fetch(`https://api.resend.com${path}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
  }

  private async getJson(path: string): Promise<Record<string, unknown> | null> {
    const res = await this.resendFetch(path);
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Resend ${res.status}`);
    }
    const body = (await res.json()) as unknown;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const rec = body as Record<string, unknown>;
      if (rec.data && typeof rec.data === 'object' && !Array.isArray(rec.data)) {
        return rec.data as Record<string, unknown>;
      }
      return rec;
    }
    return null;
  }

  private async listAttachmentsJson(
    path: string,
  ): Promise<ResendStoredAttachment[]> {
    const res = await this.resendFetch(path);
    if (res.status === 404) return [];
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Adjuntos Resend ${path}: ${text || res.status}`);
      return [];
    }
    const body = (await res.json()) as unknown;
    const list = Array.isArray(body)
      ? body
      : body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
        ? (body as { data: unknown[] }).data
        : [];
    return list
      .map((item) => this.parseStoredAttachment(item))
      .filter((a): a is ResendStoredAttachment => Boolean(a));
  }

  private parseStoredAttachment(item: unknown): ResendStoredAttachment | null {
    if (!item || typeof item !== 'object') return null;
    const a = item as Record<string, unknown>;
    const id = a.id != null ? String(a.id).trim() : '';
    if (!id) return null;
    const filename =
      a.filename != null
        ? String(a.filename)
        : a.file_name != null
          ? String(a.file_name)
          : undefined;
    const contentType =
      a.content_type != null
        ? String(a.content_type)
        : a.contentType != null
          ? String(a.contentType)
          : undefined;
    const contentDisposition =
      a.content_disposition != null
        ? String(a.content_disposition)
        : a.contentDisposition != null
          ? String(a.contentDisposition)
          : undefined;
    const contentId =
      a.content_id != null
        ? String(a.content_id)
        : a.contentId != null
          ? String(a.contentId)
          : undefined;
    const downloadUrl =
      a.download_url != null
        ? String(a.download_url)
        : a.downloadUrl != null
          ? String(a.downloadUrl)
          : undefined;
    const size = typeof a.size === 'number' ? a.size : undefined;
    return {
      id,
      filename,
      contentType,
      contentDisposition,
      contentId,
      size,
      downloadUrl,
    };
  }

  /*
  // --- SMTP (nodemailer / HestiaCP) — reactivar si se vuelve atrás de Resend ---
  isSmtpConfigured(): boolean {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS');
    return Boolean(host && user && pass !== undefined && String(pass).length > 0);
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587) || 587;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS');
    const secure =
      this.config.get<string>('SMTP_SECURE')?.toLowerCase() === 'true';

    if (!host || !user || pass === undefined || String(pass).length === 0) {
      throw new ServiceUnavailableException(
        'SMTP no configurado. Define SMTP_HOST, SMTP_USER y SMTP_PASS en el entorno.',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    return this.transporter;
  }

  async sendHtmlEmailSmtp(params: {
    to: string;
    subject: string;
    html: string;
    attachments?: MailAttachmentInput[];
  }): Promise<void> {
    const fromUser = this.config.get<string>('SMTP_USER')?.trim();
    const from =
      fromUser != null && fromUser.length > 0
        ? `"Taxi Monterrico" <${fromUser}>`
        : undefined;

    try {
      await this.getTransporter().sendMail({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Fallo SMTP para ${params.to}: ${msg}`);
      throw err;
    }
  }
  */
}
