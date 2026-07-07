import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { simpleParser } from 'mailparser';
import { PrismaService } from '../prisma/prisma.service';
import { EntitySyncService } from '../sync/entity-sync.service';

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
  ) {}

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
        };
      }),
    );
    return { messages: list, nextPageToken: res.data.nextPageToken ?? null, resultSizeEstimate: res.data.resultSizeEstimate ?? 0 };
  }

  async getMessage(userId: string, messageId: string) {
    const gmail = await this.getGmailClient(userId);

    // Fetch full format for headers + attachment metadata
    const full = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const headers = full.data.payload?.headers ?? [];

    // Fetch raw format for reliable body extraction via mailparser
    const raw = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'raw' });
    const rawEmail = Buffer.from(raw.data.raw ?? '', 'base64url').toString();
    let body = full.data.snippet || '';
    try {
      const parsed = await simpleParser(rawEmail);
      body = parsed.text || parsed.html || body;
      this.logger.log(`[getMessage OK] subject="${headers.find((h) => h.name === 'Subject')?.value}" html=${typeof parsed.html === 'string' ? parsed.html.length : 'false'} text=${typeof parsed.text === 'string' ? parsed.text.length : 'false'} bodyLen=${body.length} attachments=${parsed.attachments.length}`);
    } catch (e: any) {
      this.logger.error(`[getMessage FAIL] mailparser error: ${e?.message || e}`);
    }

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

    return {
      id: full.data.id,
      threadId: full.data.threadId,
      subject: headers.find((h) => h.name === 'Subject')?.value ?? '',
      from: headers.find((h) => h.name === 'From')?.value ?? '',
      to: headers.find((h) => h.name === 'To')?.value ?? '',
      date: headers.find((h) => h.name === 'Date')?.value ?? '',
      cc: headers.find((h) => h.name === 'Cc')?.value ?? '',
      body,
      attachments,
      labelIds: full.data.labelIds ?? [],
    };
  }

  async sendMessage(userId: string, to: string, subject: string, bodyHtml: string, cc?: string) {
    const gmail = await this.getGmailClient(userId);
    const emailLines: string[] = [];
    emailLines.push(`From: me`);
    emailLines.push(`To: ${to}`);
    if (cc) emailLines.push(`Cc: ${cc}`);
    emailLines.push(`Subject: ${subject}`);
    emailLines.push('MIME-Version: 1.0');
    emailLines.push('Content-Type: text/html; charset=utf-8');
    emailLines.push('');
    emailLines.push(bodyHtml);
    const encoded = Buffer.from(emailLines.join('\r\n')).toString('base64url');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
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

  async linkEmail(to: string, subject: string, assignedTo?: string) {
    const emailRegex = /([^<]+)?\s*<([^>]+)>|([^\s,;]+)/g;
    const recipients: { name?: string; email: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = emailRegex.exec(to)) !== null) {
      if (match[2]) {
        recipients.push({ name: match[1]?.trim(), email: match[2] });
      } else if (match[3]) {
        recipients.push({ email: match[3] });
      }
    }

    const results: { email: string; contactId?: string; companyId?: string; opportunityId?: string }[] = [];

    for (const { name, email: rawEmail } of recipients) {
      const email = rawEmail.trim().toLowerCase();
      if (!email || !email.includes('@')) continue;

      // 1. Buscar o crear contacto
      let contact = await this.prisma.contact.findFirst({ where: { correo: email } });
      if (!contact) {
        const contactName = name || email;
        const ts = Date.now();
        contact = await this.prisma.contact.create({
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
        this.logger.log(`Contacto creado: ${contact.id} (${email})`);
      }

      // 2. Extraer dominio
      const domain = email.split('@')[1].toLowerCase();

      // 3. Buscar o crear empresa
      let company = await this.prisma.company.findFirst({
        where: { domain: { equals: domain, mode: 'insensitive' } },
      });
      if (!company) {
        const ts = Date.now();
        company = await this.prisma.company.create({
          data: {
            name: domain,
            domain,
            urlSlug: `gmail-${ts}-${Math.random().toString(36).slice(2, 6)}`,
            fuente: 'referido',
            facturacionEstimada: 0,
          },
        });
        this.logger.log(`Empresa creada: ${company.id} (${domain})`);
      }

      // 4. Vincular contacto a empresa (si no existe el vínculo)
      const existingLink = await this.prisma.companyContact.findUnique({
        where: { companyId_contactId: { companyId: company.id, contactId: contact.id } },
      });
      if (!existingLink) {
        await this.prisma.companyContact.create({
          data: { companyId: company.id, contactId: contact.id },
        });
        this.logger.log(`Contacto ${contact.id} vinculado a empresa ${company.id}`);
      }

      // 5. Crear oportunidad
      const ts = Date.now();
      const opp = await this.prisma.opportunity.create({
        data: {
          title: domain,
          amount: 2000,
          etapa: 'lead',
          fuente: 'referido',
          assignedTo: assignedTo || null,
          urlSlug: `gmail-${ts}-${Math.random().toString(36).slice(2, 6)}`,
          probability: 0,
          companies: {
            create: { companyId: company.id },
          },
          contacts: {
            create: { contactId: contact.id },
          },
        },
      });
      this.logger.log(`Oportunidad creada: ${opp.id} (${domain})`);

      // 6. Sincronizar: oportunidad → empresa → contactos
      await this.entitySync.propagateFromOpportunityAllCompanies(opp.id);
      this.logger.log(`Sincronización completada para oportunidad ${opp.id}`);

      results.push({ email, contactId: contact.id, companyId: company.id, opportunityId: opp.id });
    }

    return { linked: results };
  }
}
