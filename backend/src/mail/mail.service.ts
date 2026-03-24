import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type MailAttachmentInput = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

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

  /**
   * Envía un correo HTML. `from` usa SMTP_USER si no se indica otro remitente autorizado en el servidor.
   */
  async sendHtmlEmail(params: {
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
}
