import { Injectable, UnauthorizedException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoogleCalendarService {
  private getOAuth2Client(tokens: any) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  }

  constructor(private readonly prisma: PrismaService) {}

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
}
