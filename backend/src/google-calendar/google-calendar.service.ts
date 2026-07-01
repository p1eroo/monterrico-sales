import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { EntitySyncService } from '../sync/entity-sync.service';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

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

  private async getCalendarClient(userId: string) {
    const account = await this.prisma.account.findFirst({
      where: { userId, provider: 'google' },
      select: { tokens: true },
    });
    if (!account?.tokens) {
      throw new UnauthorizedException('Google account not connected');
    }
    const auth = this.getOAuth2Client(account.tokens);
    return google.calendar({ version: 'v3', auth });
  }

  async listEvents(userId: string, opts?: { maxResults?: number; timeMin?: string; timeMax?: string }) {
    const calendar = await this.getCalendarClient(userId);
    const res = await calendar.events.list({
      calendarId: 'primary',
      maxResults: opts?.maxResults ?? 100,
      timeMin: opts?.timeMin,
      timeMax: opts?.timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return res.data.items ?? [];
  }

  async createEvent(userId: string, event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: { email: string }[];
  }) {
    const calendar = await this.getCalendarClient(userId);
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
    return res.data;
  }

  async updateEvent(userId: string, eventId: string, event: {
    summary?: string;
    description?: string;
    start?: { dateTime: string; timeZone?: string };
    end?: { dateTime: string; timeZone?: string };
  }) {
    const calendar = await this.getCalendarClient(userId);
    const res = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: event,
    });
    return res.data;
  }

  async deleteEvent(userId: string, eventId: string) {
    const calendar = await this.getCalendarClient(userId);
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return { ok: true };
  }

  async listTaskLists(userId: string) {
    const account = await this.prisma.account.findFirst({
      where: { userId, provider: 'google' },
      select: { tokens: true },
    });
    if (!account?.tokens) {
      throw new UnauthorizedException('Google account not connected');
    }
    const auth = this.getOAuth2Client(account.tokens);
    const tasks = google.tasks({ version: 'v1', auth });
    const res = await tasks.tasklists.list();
    return res.data.items ?? [];
  }

  async createTask(userId: string, taskListId: string, title: string, notes?: string, due?: string) {
    const account = await this.prisma.account.findFirst({
      where: { userId, provider: 'google' },
      select: { tokens: true },
    });
    if (!account?.tokens) {
      throw new UnauthorizedException('Google account not connected');
    }
    const auth = this.getOAuth2Client(account.tokens);
    const tasks = google.tasks({ version: 'v1', auth });
    const res = await tasks.tasks.insert({
      tasklist: taskListId,
      requestBody: { title, notes, due },
    });
    return res.data;
  }

  async linkEvent(data: {
    attendees: { name?: string; email: string }[];
    eventTitle: string;
    eventDescription?: string;
    eventDate: string;
    eventStartTime?: string;
    assignedTo: string;
  }) {
    const results: { email: string; contactId?: string; companyId?: string; opportunityId?: string }[] = [];

    for (const a of data.attendees) {
      if (!a.email) continue;
      const email = a.email.trim().toLowerCase();
      const domain = email.split('@')[1].toLowerCase();

      // 1. Buscar o crear contacto
      let contact = await this.prisma.contact.findFirst({ where: { correo: email } });
      if (!contact) {
        const ts = Date.now();
        contact = await this.prisma.contact.create({
          data: {
            name: a.name || email,
            correo: email,
            telefono: '-',
            urlSlug: `gcal-${ts}-${Math.random().toString(36).slice(2, 6)}`,
            fuente: 'referido',
            etapa: 'lead',
            estimatedValue: 0,
          },
        });
        this.logger.log(`Contacto creado: ${contact.id} (${email})`);
      }

      // 2. Buscar o crear empresa por dominio
      let company = await this.prisma.company.findFirst({
        where: { domain: { equals: domain, mode: 'insensitive' } },
      });
      if (!company) {
        const ts = Date.now();
        company = await this.prisma.company.create({
          data: {
            name: domain,
            domain,
            urlSlug: `gcal-${ts}-${Math.random().toString(36).slice(2, 6)}`,
            fuente: 'referido',
            facturacionEstimada: 0,
          },
        });
        this.logger.log(`Empresa creada: ${company.id} (${domain})`);
      }

      // 3. Vincular contacto a empresa
      const existingLink = await this.prisma.companyContact.findUnique({
        where: { companyId_contactId: { companyId: company.id, contactId: contact.id } },
      });
      if (!existingLink) {
        await this.prisma.companyContact.create({
          data: { companyId: company.id, contactId: contact.id },
        });
      }

      // 4. Crear oportunidad vinculada a empresa y contacto
      const ts = Date.now();
      const opp = await this.prisma.opportunity.create({
        data: {
          title: domain,
          amount: 2000,
          etapa: 'lead',
          fuente: 'referido',
          assignedTo: data.assignedTo || null,
          urlSlug: `gcal-${ts}-${Math.random().toString(36).slice(2, 6)}`,
          probability: 0,
          companies: { create: { companyId: company.id } },
          contacts: { create: { contactId: contact.id } },
        },
      });
      this.logger.log(`Oportunidad creada: ${opp.id} (${domain})`);

      // 5. Sincronizar
      await this.entitySync.propagateFromOpportunityAllCompanies(opp.id);

      // 6. Crear actividad (reunión)
      const activityDate = new Date(data.eventDate);
      await this.prisma.activity.create({
        data: {
          type: 'reunion',
          title: data.eventTitle,
          description: data.eventDescription ?? '',
          assignedTo: data.assignedTo,
          status: 'pendiente',
          dueDate: activityDate,
          startDate: activityDate,
          startTime: data.eventStartTime || null,
          contacts: { create: { contactId: contact.id } },
          companies: { create: { companyId: company.id } },
          opportunities: { create: { opportunityId: opp.id } },
        },
      });
      this.logger.log(`Actividad creada para contacto ${contact.id}`);

      results.push({ email, contactId: contact.id, companyId: company.id, opportunityId: opp.id });
    }

    return { linked: results };
  }
}
