import { BadRequestException, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { simpleParser } from 'mailparser';
import { PrismaService } from '../prisma/prisma.service';
import { EntitySyncService } from '../sync/entity-sync.service';
import { CompanyLogoService } from '../companies/company-logo.service';
import { EmailSignatureService } from './email-signature.service';
import {
  buildMultipartEmailLines,
  embedInlineImagesInHtml,
} from './email-inline-images.util';

/** Dominios de correo personales: no tienen logo de marca, se usa la inicial. */
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'outlook.com',
  'outlook.es',
  'live.com',
  'live.com.mx',
  'msn.com',
  'yahoo.com',
  'yahoo.es',
  'ymail.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'zoho.com',
]);

/** Dominios que no generan contacto, empresa ni oportunidad al vincular correo enviado. */
const CRM_LINK_EXCLUDED_DOMAINS = new Set([
  'gmail.com',
  'taximonterrico.com',
]);

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  private getOAuth2Client(tokens: any) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitySync: EntitySyncService,
    private readonly companyLogo: CompanyLogoService,
    private readonly emailSignature: EmailSignatureService,
  ) {}

  /**
   * Resuelve el logo del remitente por su dominio (mismo pipeline que empresas:
   * MinIO → DuckDuckGo). Devuelve null para dominios personales (se usa inicial).
   */
  async getSenderAvatar(from: string): Promise<{ body: Buffer; contentType: string } | null> {
    if (!from) return null;
    const match = from.match(/<([^>]+)>/);
    const email = (match ? match[1] : from).trim().toLowerCase();
    if (!email.includes('@')) return null;
    const domain = email.split('@')[1]?.trim();
    if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return null;
    return this.companyLogo.getLogoByDomain(domain);
  }

  private async getGmailClient(userId: string) {
    const account = await this.prisma.account.findFirst({
      where: { userId, provider: 'google' },
      select: { tokens: true },
    });
    if (!account?.tokens) {
      throw new UnauthorizedException('Google account not connected');
    }
    const auth = this.getOAuth2Client(account.tokens);
    return google.gmail({ version: 'v1', auth });
  }

  async listMessages(userId: string, opts?: { maxResults?: number; labelIds?: string[]; pageToken?: string; q?: string }) {
    const gmail = await this.getGmailClient(userId);
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: opts?.maxResults ?? 50,
      labelIds: opts?.labelIds,
      pageToken: opts?.pageToken,
      q: opts?.q,
    });
    const messages = res.data.messages ?? [];
    const list = await Promise.all(
      messages.map(async (m) => {
        const detail = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'metadata' });
        const headers = detail.data.payload?.headers ?? [];
        return {
          id: m.id,
          threadId: detail.data.threadId,
          subject: headers.find((h) => h.name === 'Subject')?.value ?? '',
          from: headers.find((h) => h.name === 'From')?.value ?? '',
          date: headers.find((h) => h.name === 'Date')?.value ?? '',
          snippet: detail.data.snippet ?? '',
          labelIds: detail.data.labelIds ?? [],
          hasAttachments: this.detectAttachments(detail.data.payload),
        };
      }),
    );
    return { messages: list, nextPageToken: res.data.nextPageToken ?? null, resultSizeEstimate: res.data.resultSizeEstimate ?? 0 };
  }

  private detectAttachments(payload: any): boolean {
    if (!payload) return false;
    const walk = (p: any): boolean => {
      if (!p) return false;
      if (p.filename && (p.body?.attachmentId || (p.body?.size ?? 0) > 0)) return true;
      return (p.parts ?? []).some(walk);
    };
    // Estructura de partes (disponible en formato metadata para multipart)
    if (walk(payload)) return true;
    // Respaldo por tipo MIME: multipart/mixed suele indicar adjuntos
    return payload.mimeType === 'multipart/mixed';
  }

  private async parseMessage(gmail: any, messageId: string) {
    // Fetch full format for headers + attachment metadata
    const full = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const headers = full.data.payload?.headers ?? [];

    // Fetch raw format for reliable body extraction via mailparser
    const raw = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'raw' });
    const rawEmail = Buffer.from(raw.data.raw ?? '', 'base64url').toString();
    const snippet = full.data.snippet || '';
    let bodyHtml: string | null = null;
    let bodyText: string | null = null;
    try {
      const parsed = await simpleParser(rawEmail);
      bodyHtml =
        typeof parsed.html === 'string' && parsed.html.trim() ? parsed.html : null;
      bodyText =
        typeof parsed.text === 'string' && parsed.text.trim() ? parsed.text : null;
      this.logger.log(
        `[parseMessage OK] subject="${headers.find((h) => h.name === 'Subject')?.value}" html=${bodyHtml?.length ?? 0} text=${bodyText?.length ?? 0} attachments=${parsed.attachments.length}`,
      );
    } catch (e: any) {
      this.logger.error(`[parseMessage FAIL] mailparser error: ${e?.message || e}`);
    }
    const body = bodyHtml || bodyText || snippet;

    // Extract attachment metadata from full format
    const attachments: any[] = [];
    const walkAttachments = (p: any) => {
      if (!p) return;
      if (p.filename && p.body?.attachmentId) {
        attachments.push({
          filename: p.filename,
          mimeType: p.mimeType,
          attachmentId: p.body.attachmentId,
          size: p.body.size,
        });
      }
      if (p.parts) {
        for (const part of p.parts) walkAttachments(part);
      }
    };
    walkAttachments(full.data.payload);

    const messageIdHeader =
      headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value ?? '';

    return {
      id: full.data.id,
      threadId: full.data.threadId,
      messageId: messageIdHeader,
      subject: headers.find((h) => h.name === 'Subject')?.value ?? '',
      from: headers.find((h) => h.name === 'From')?.value ?? '',
      to: headers.find((h) => h.name === 'To')?.value ?? '',
      date: headers.find((h) => h.name === 'Date')?.value ?? '',
      cc: headers.find((h) => h.name === 'Cc')?.value ?? '',
      body,
      bodyHtml,
      bodyText,
      attachments,
      labelIds: full.data.labelIds ?? [],
    };
  }

  async getMessage(userId: string, messageId: string) {
    const gmail = await this.getGmailClient(userId);
    return this.parseMessage(gmail, messageId);
  }

  async getThread(userId: string, threadId: string) {
    const gmail = await this.getGmailClient(userId);
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'metadata',
      metadataHeaders: ['Subject'],
    });
    const messageIds = (thread.data.messages ?? [])
      .map((m: any) => m.id as string)
      .filter(Boolean);
    const messages = await Promise.all(
      messageIds.map((id: string) => this.parseMessage(gmail, id)),
    );
    const subject =
      messages[0]?.subject ||
      thread.data.messages?.[0]?.payload?.headers?.find(
        (h: any) => h.name === 'Subject',
      )?.value ||
      '';
    return { id: threadId, subject, messages };
  }

  async markThreadAsRead(userId: string, threadId: string) {
    const gmail = await this.getGmailClient(userId);
    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  async setThreadStarred(userId: string, threadId: string, starred: boolean) {
    const gmail = await this.getGmailClient(userId);
    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: starred
        ? { addLabelIds: ['STARRED'] }
        : { removeLabelIds: ['STARRED'] },
    });
  }

  async archiveThread(userId: string, threadId: string) {
    const gmail = await this.getGmailClient(userId);
    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        removeLabelIds: ['INBOX'],
      },
    });
  }

  async trashThread(userId: string, threadId: string) {
    const gmail = await this.getGmailClient(userId);
    await gmail.users.threads.trash({
      userId: 'me',
      id: threadId,
    });
  }

  async markThreadAsUnread(userId: string, threadId: string) {
    const gmail = await this.getGmailClient(userId);
    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        addLabelIds: ['UNREAD'],
      },
    });
  }

  private buildRawEmail(params: {
    to: string;
    cc?: string;
    subject: string;
    bodyHtml: string;
    inReplyTo?: string;
    attachments?: { fileName: string; mimeType?: string; contentBase64: string }[];
    inlineImages?: { cid: string; mimeType: string; content: Buffer; fileName: string }[];
  }): string {
    const attachmentBuffers: { fileName: string; mimeType: string; content: Buffer }[] = [];
    for (const att of params.attachments ?? []) {
      const fileName = att.fileName?.trim();
      const b64 = att.contentBase64?.trim();
      if (!fileName || !b64) continue;
      try {
        const content = Buffer.from(b64, 'base64');
        if (content.length === 0) continue;
        attachmentBuffers.push({
          fileName,
          mimeType: att.mimeType?.trim() || 'application/octet-stream',
          content,
        });
      } catch {
        throw new BadRequestException(`Adjunto inválido: ${fileName}`);
      }
    }

    const lines = buildMultipartEmailLines({
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      inReplyTo: params.inReplyTo,
      attachments: attachmentBuffers,
      inlineImages: params.inlineImages ?? [],
    });

    return Buffer.from(lines.join('\r\n')).toString('base64url');
  }

  async sendMessage(
    userId: string,
    to: string,
    subject: string,
    bodyHtml: string,
    cc?: string,
    threadId?: string,
    inReplyTo?: string,
    attachments?: { fileName: string; mimeType?: string; contentBase64: string }[],
  ) {
    const { html: processedHtml, inlineImages } = await embedInlineImagesInHtml(
      bodyHtml,
      (src) => this.emailSignature.resolveStoredImage(userId, src),
    );

    const gmail = await this.getGmailClient(userId);
    const encoded = this.buildRawEmail({
      to,
      cc,
      subject,
      bodyHtml: processedHtml,
      inReplyTo,
      attachments,
      inlineImages,
    });
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encoded,
        ...(threadId ? { threadId } : {}),
      },
    });
  }

  async downloadAttachment(userId: string, messageId: string, attachmentId: string) {
    const gmail = await this.getGmailClient(userId);

    const attachmentRes = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    const data = Buffer.from(attachmentRes.data.data ?? '', 'base64');

    const messageRes = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const parts = messageRes.data.payload?.parts ?? [];
    let filename = 'attachment';
    let mimeType = 'application/octet-stream';

    const findPart = (pList: any[]): boolean => {
      for (const p of pList) {
        if (p.body?.attachmentId === attachmentId) {
          filename = p.filename || filename;
          mimeType = p.mimeType || mimeType;
          return true;
        }
        if (p.parts && findPart(p.parts)) return true;
      }
      return false;
    };
    findPart(parts);

    return { data, filename, mimeType };
  }

  async getUserProfile(userId: string) {
    const gmail = await this.getGmailClient(userId);
    const res = await gmail.users.getProfile({ userId: 'me' });
    return res.data;
  }

  private async resolveCompanyForEmail(contactId: string, domain: string) {
    const byDomain = await this.prisma.company.findFirst({
      where: { domain: { equals: domain, mode: 'insensitive' } },
    });
    if (byDomain) return byDomain;

    const link = await this.prisma.companyContact.findFirst({
      where: { contactId },
      orderBy: [{ isPrimary: 'desc' }],
      include: { company: true },
    });
    return link?.company ?? null;
  }

  private async resolveOpportunityForEmail(contactId: string, companyId?: string) {
    if (companyId) {
      const linked = await this.prisma.contactOpportunity.findFirst({
        where: {
          contactId,
          opportunity: { companies: { some: { companyId } } },
        },
        orderBy: { opportunity: { createdAt: 'desc' } },
        select: { opportunityId: true },
      });
      if (linked) return linked.opportunityId;

      const companyOpp = await this.prisma.companyOpportunity.findFirst({
        where: { companyId },
        orderBy: { opportunity: { createdAt: 'desc' } },
        select: { opportunityId: true },
      });
      if (companyOpp) return companyOpp.opportunityId;
    }

    const contactOpp = await this.prisma.contactOpportunity.findFirst({
      where: { contactId },
      orderBy: { opportunity: { createdAt: 'desc' } },
      select: { opportunityId: true },
    });
    return contactOpp?.opportunityId;
  }

  private parseEmailAddresses(header: string): { name?: string; email: string }[] {
    const emailRegex = /([^<]+)?\s*<([^>]+)>|([^\s,;]+)/g;
    const recipients: { name?: string; email: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = emailRegex.exec(header)) !== null) {
      if (match[2]) {
        recipients.push({ name: match[1]?.trim(), email: match[2] });
      } else if (match[3]) {
        recipients.push({ email: match[3] });
      }
    }
    return recipients;
  }

  private parseActivityDate(value?: string): Date | undefined {
    if (!value?.trim()) return undefined;
    const parsed = new Date(`${value.trim()}T12:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private async createEmailActivity(
    assignedTo: string,
    subject: string,
    email: string,
    contactId: string,
    companyId?: string,
    opportunityId?: string,
    direction: 'inbound' | 'outbound' = 'outbound',
    overrides?: {
      title?: string;
      description?: string;
      dueDate?: string;
      startDate?: string;
      startTime?: string;
    },
  ): Promise<string> {
    const now = new Date();
    const dueDate = this.parseActivityDate(overrides?.dueDate) ?? now;
    const startDate = this.parseActivityDate(overrides?.startDate) ?? dueDate;
    const title =
      overrides?.title?.trim() ||
      subject.trim() ||
      (direction === 'inbound' ? `Correo de ${email}` : `Correo a ${email}`);
    const description =
      overrides?.description?.trim() ||
      (direction === 'inbound'
        ? `Correo recibido de ${email}`
        : `Correo enviado a ${email}`);
    const activity = await this.prisma.$transaction(async (tx) => {
      const row = await tx.activity.create({
        data: {
          type: 'correo',
          title,
          description,
          assignedTo,
          status: 'completada',
          priority: 'media',
          dueDate,
          startDate,
          startTime: overrides?.startTime?.trim() || undefined,
          completedAt: dueDate,
        },
      });
      await tx.contactActivity.create({
        data: { contactId, activityId: row.id },
      });
      if (companyId) {
        await tx.companyActivity.create({
          data: { companyId, activityId: row.id },
        });
      }
      if (opportunityId) {
        await tx.opportunityActivity.create({
          data: { opportunityId, activityId: row.id },
        });
      }
      return row;
    });
    this.logger.log(`Actividad correo creada: ${activity.id} (${email})`);
    return activity.id;
  }

  async previewRegisterEmailActivity(counterparty: string) {
    const parsed = this.parseEmailAddresses(counterparty)[0];
    if (!parsed) {
      throw new BadRequestException('Dirección de correo inválida');
    }
    return this.buildRegisterEmailPlan(parsed.name, parsed.email);
  }

  private async buildRegisterEmailPlan(name: string | undefined, rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const domain = email.split('@')[1]?.trim().toLowerCase() ?? '';
    const excluded = !domain || CRM_LINK_EXCLUDED_DOMAINS.has(domain);

    if (excluded) {
      return {
        email,
        domain,
        excluded: true,
        contact: { action: 'skip' as const, name: name?.trim() || email },
        company: { action: 'skip' as const, name: domain || '—' },
        opportunity: { action: 'skip' as const, name: '—' },
      };
    }

    const existingContact = await this.prisma.contact.findFirst({
      where: { correo: email },
    });

    if (existingContact) {
      const company = await this.resolveCompanyForEmail(existingContact.id, domain);
      const opportunityId = await this.resolveOpportunityForEmail(
        existingContact.id,
        company?.id,
      );
      let opportunityName = '—';
      if (opportunityId) {
        const opp = await this.prisma.opportunity.findUnique({
          where: { id: opportunityId },
          select: { title: true },
        });
        opportunityName = opp?.title?.trim() || 'Oportunidad existente';
      }

      return {
        email,
        domain,
        excluded: false,
        contact: { action: 'link' as const, name: existingContact.name?.trim() || email },
        company: company
          ? { action: 'link' as const, name: company.name?.trim() || domain }
          : { action: 'skip' as const, name: domain },
        opportunity: opportunityId
          ? { action: 'link' as const, name: opportunityName }
          : { action: 'skip' as const, name: '—' },
      };
    }

    const contactLabel = name?.trim() || email;
    const existingCompany = await this.prisma.company.findFirst({
      where: { domain: { equals: domain, mode: 'insensitive' } },
    });

    return {
      email,
      domain,
      excluded: false,
      contact: { action: 'create' as const, name: contactLabel },
      company: existingCompany
        ? { action: 'link' as const, name: existingCompany.name?.trim() || domain }
        : { action: 'create' as const, name: domain },
      opportunity: { action: 'create' as const, name: domain },
    };
  }

  async registerEmailAsActivity(
    counterparty: string,
    subject: string,
    direction: 'inbound' | 'outbound',
    assignedTo?: string,
    activityOverrides?: {
      title?: string;
      description?: string;
      dueDate?: string;
      startDate?: string;
      startTime?: string;
    },
  ) {
    return this.linkCounterpartyEmails(
      counterparty,
      subject,
      direction,
      assignedTo,
      activityOverrides,
    );
  }

  async linkEmail(to: string, subject: string, assignedTo?: string) {
    return this.linkCounterpartyEmails(to, subject, 'outbound', assignedTo);
  }

  private async linkCounterpartyEmails(
    header: string,
    subject: string,
    direction: 'inbound' | 'outbound',
    assignedTo?: string,
    activityOverrides?: {
      title?: string;
      description?: string;
      dueDate?: string;
      startDate?: string;
      startTime?: string;
    },
  ) {
    if (!assignedTo) {
      throw new BadRequestException('Usuario no autenticado');
    }

    const recipients = this.parseEmailAddresses(header);

    const results: {
      email: string;
      contactId: string;
      companyId?: string;
      opportunityId?: string;
      activityId: string;
      created: { contact: boolean; company: boolean; opportunity: boolean };
    }[] = [];

    for (const { name, email: rawEmail } of recipients) {
      const email = rawEmail.trim().toLowerCase();
      if (!email || !email.includes('@')) continue;

      const domain = email.split('@')[1]?.trim().toLowerCase();
      if (!domain || CRM_LINK_EXCLUDED_DOMAINS.has(domain)) {
        this.logger.log(`Omitiendo vinculación CRM para ${email} (dominio excluido: ${domain ?? 'n/a'})`);
        continue;
      }

      const created = { contact: false, company: false, opportunity: false };
      let contactId: string;
      let companyId: string | undefined;
      let opportunityId: string | undefined;

      const existingContact = await this.prisma.contact.findFirst({ where: { correo: email } });
      if (existingContact) {
        contactId = existingContact.id;
        this.logger.log(`Contacto ya existe, reutilizando: ${email}`);
        const company = await this.resolveCompanyForEmail(contactId, domain);
        companyId = company?.id;
        opportunityId = await this.resolveOpportunityForEmail(contactId, companyId);
      } else {
        const contactName = name || email;
        const ts = Date.now();
        const contact = await this.prisma.contact.create({
          data: {
            name: contactName,
            correo: email,
            telefono: '-',
            urlSlug: `gmail-${ts}-${Math.random().toString(36).slice(2, 6)}`,
            fuente: 'referido',
            etapa: 'lead',
            estimatedValue: 0,
          },
        });
        contactId = contact.id;
        created.contact = true;
        this.logger.log(`Contacto creado: ${contact.id} (${email})`);

        let company = await this.prisma.company.findFirst({
          where: { domain: { equals: domain, mode: 'insensitive' } },
        });
        if (!company) {
          const companyTs = Date.now();
          company = await this.prisma.company.create({
            data: {
              name: domain,
              domain,
              urlSlug: `gmail-${companyTs}-${Math.random().toString(36).slice(2, 6)}`,
              fuente: 'referido',
              facturacionEstimada: 0,
            },
          });
          created.company = true;
          this.logger.log(`Empresa creada: ${company.id} (${domain})`);
        }

        companyId = company.id;

        const existingLink = await this.prisma.companyContact.findUnique({
          where: { companyId_contactId: { companyId: company.id, contactId } },
        });
        if (!existingLink) {
          await this.prisma.companyContact.create({
            data: { companyId: company.id, contactId },
          });
          this.logger.log(`Contacto ${contactId} vinculado a empresa ${company.id}`);
        }

        const oppTs = Date.now();
        const opp = await this.prisma.opportunity.create({
          data: {
            title: domain,
            amount: 2000,
            etapa: 'lead',
            fuente: 'referido',
            assignedTo,
            urlSlug: `gmail-${oppTs}-${Math.random().toString(36).slice(2, 6)}`,
            probability: 0,
            companies: {
              create: { companyId: company.id },
            },
            contacts: {
              create: { contactId },
            },
          },
        });
        opportunityId = opp.id;
        created.opportunity = true;
        this.logger.log(`Oportunidad creada: ${opp.id} (${domain})`);

        await this.entitySync.propagateFromOpportunityAllCompanies(opp.id);
        this.logger.log(`Sincronización completada para oportunidad ${opp.id}`);
      }

      const activityId = await this.createEmailActivity(
        assignedTo,
        subject,
        email,
        contactId,
        companyId,
        opportunityId,
        direction,
        activityOverrides,
      );

      results.push({ email, contactId, companyId, opportunityId, activityId, created });
    }

    if (results.length === 0) {
      throw new BadRequestException(
        'No se pudo vincular el correo (dominio excluido o dirección inválida)',
      );
    }

    return { linked: results };
  }
}
