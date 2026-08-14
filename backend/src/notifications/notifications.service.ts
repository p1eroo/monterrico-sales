import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CRM_PERM_VER_DATOS_EQUIPO } from '../auth/crm-data-scope.service';
import { NotificationsGateway } from './notifications.gateway';

export type NotificationApiItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  type: string;
  kind: string;
  priority: string;
  important: boolean;
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  activityId?: string;
};

type NotificationMeta = {
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  activityId?: string;
};

function parseMeta(raw: Prisma.JsonValue | null | undefined): NotificationMeta {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const contactId = typeof o.contactId === 'string' ? o.contactId : undefined;
  const companyId = typeof o.companyId === 'string' ? o.companyId : undefined;
  const opportunityId =
    typeof o.opportunityId === 'string' ? o.opportunityId : undefined;
  const activityId = typeof o.activityId === 'string' ? o.activityId : undefined;
  return { contactId, companyId, opportunityId, activityId };
}

const PEN_FMT = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  maximumFractionDigits: 0,
});

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  private pingUsers(userIds: string[], kind: string) {
    try {
      this.gateway.emitToUsers(userIds, kind);
    } catch (err) {
      this.logger.warn(
        `No se pudo emitir socket ${kind}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private toApiItem(row: {
    id: string;
    title: string;
    body: string;
    readAt: Date | null;
    kind: string;
    notifType: string;
    priority: string;
    important: boolean;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  }): NotificationApiItem {
    const meta = parseMeta(row.metadata);
    return {
      id: row.id,
      title: row.title,
      description: row.body,
      createdAt: row.createdAt.toISOString(),
      read: row.readAt != null,
      type: row.notifType,
      kind: row.kind,
      priority: row.priority,
      important: row.important,
      ...meta,
    };
  }

  async syncTaskOverdueForUser(userId: string): Promise<void> {
    const now = new Date();
    const overdue = await this.prisma.activity.findMany({
      where: {
        assignedTo: userId,
        type: 'tarea',
        dueDate: { lt: now },
        completedAt: null,
        status: {
          notIn: [
            'completada',
            'Completado',
            'completado',
            'Completada',
          ],
        },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        contacts: {
          take: 1,
          select: { contact: { select: { id: true, name: true } } },
        },
      },
    });

    const validKeys = overdue.map((a) => `overdue:${a.id}`);

    if (validKeys.length === 0) {
      await this.prisma.crmNotification.deleteMany({
        where: {
          userId,
          kind: 'task_overdue',
        },
      });
      return;
    }

    await this.prisma.crmNotification.deleteMany({
      where: {
        userId,
        kind: 'task_overdue',
        dedupeKey: { notIn: validKeys },
      },
    });

    for (const a of overdue) {
      const contact = a.contacts[0]?.contact;
      const contactSuffix = contact ? ` (${contact.name})` : '';
      const body = `La tarea «${a.title}» venció${contactSuffix}.`;
      const meta: NotificationMeta = {
        activityId: a.id,
        ...(contact ? { contactId: contact.id } : {}),
      };
      await this.prisma.crmNotification.upsert({
        where: {
          userId_dedupeKey: {
            userId,
            dedupeKey: `overdue:${a.id}`,
          },
        },
        create: {
          userId,
          kind: 'task_overdue',
          dedupeKey: `overdue:${a.id}`,
          title: 'Tarea vencida',
          body,
          notifType: 'alerta',
          priority: 'alta',
          important: true,
          metadata: meta as Prisma.InputJsonValue,
        },
        update: {
          title: 'Tarea vencida',
          body,
          metadata: meta as Prisma.InputJsonValue,
        },
      });
    }
  }

  async removeOverdueNotificationsForActivity(activityId: string): Promise<void> {
    const key = `overdue:${activityId}`;
    await this.prisma.crmNotification.deleteMany({
      where: { dedupeKey: key },
    });
  }

  async notifyNewContact(params: {
    userId: string;
    contactId: string;
    contactName: string;
    companyName?: string | null;
  }): Promise<void> {
    const { userId, contactId, contactName, companyName } = params;
    const extra = companyName?.trim()
      ? ` · Empresa: ${companyName.trim()}`
      : '';
    await this.prisma.crmNotification.create({
      data: {
        userId,
        kind: 'contact_created',
        title: 'Nuevo contacto',
        body: `${contactName.trim()} fue añadido a tu cartera.${extra}`,
        notifType: 'lead',
        priority: 'media',
        important: false,
        metadata: { contactId } as Prisma.InputJsonValue,
      },
    });
    this.pingUsers([userId], 'contact_created');
  }

  async notifyWhatsappInbound(params: {
    userId: string;
    contactId: string;
    contactName: string;
    preview: string;
    evoInstanceName?: string | null;
    waMessageId?: string | null;
    evoInstanceId: string;
  }): Promise<void> {
    const {
      userId,
      contactId,
      contactName,
      preview,
      evoInstanceName,
      waMessageId,
      evoInstanceId,
    } = params;
    const dedupe =
      waMessageId && waMessageId.length > 0
        ? `wa:${evoInstanceId}:${waMessageId}`
        : undefined;
    const instanceBit = evoInstanceName?.trim()
      ? ` · ${evoInstanceName.trim()}`
      : '';
    const body = `${preview.trim() || '(mensaje sin texto)'}${instanceBit}`;
    const title = `WhatsApp: ${contactName.trim()}`;
    const baseData = {
      userId,
      kind: 'whatsapp_inbound',
      title,
      body,
      notifType: 'info',
      priority: 'media',
      important: false,
      metadata: { contactId } as Prisma.InputJsonValue,
    };
    if (dedupe) {
      await this.prisma.crmNotification.upsert({
        where: {
          userId_dedupeKey: { userId, dedupeKey: dedupe },
        },
        create: { ...baseData, dedupeKey: dedupe },
        update: { title, body, metadata: baseData.metadata },
      });
    } else {
      await this.prisma.crmNotification.create({
        data: baseData,
      });
    }
    this.pingUsers([userId], 'whatsapp_inbound');
  }

  async notifyOpportunityWon(params: {
    userId: string;
    opportunityId: string;
    title: string;
    amount: number;
  }): Promise<void> {
    const { userId, opportunityId, title, amount } = params;
    const money = PEN_FMT.format(Number.isFinite(amount) ? amount : 0);
    await this.prisma.crmNotification.create({
      data: {
        userId,
        kind: 'opportunity_won',
        title: 'Oportunidad ganada',
        body: `«${title.trim()}» se marcó como ganada (${money}).`,
        notifType: 'exito',
        priority: 'media',
        important: true,
        metadata: { opportunityId } as Prisma.InputJsonValue,
      },
    });
    this.pingUsers([userId], 'opportunity_won');
  }

  async notifyWebLead(params: {
    contactId?: string | null;
    companyId?: string | null;
    opportunityId?: string | null;
    contactName?: string | null;
    companyName?: string | null;
  }): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: {
        status: 'activo',
        role: {
          authorities: {
            some: { permission: CRM_PERM_VER_DATOS_EQUIPO },
          },
        },
      },
      select: { id: true },
    });
    if (users.length === 0) {
      this.logger.warn(
        'Web lead sin destinatarios: nadie tiene equipo.datos_completos',
      );
      return;
    }

    const contactName = params.contactName?.trim() || '';
    const companyName = params.companyName?.trim() || '';
    const who = contactName || companyName || 'Alguien';
    const companyBit = contactName && companyName ? ` de ${companyName}` : '';
    const body = `${who}${companyBit} quiere pertenecer a Taxi Monterrico.`;
    const metadata: NotificationMeta = {
      ...(params.contactId ? { contactId: params.contactId } : {}),
      ...(params.companyId ? { companyId: params.companyId } : {}),
      ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
    };

    await this.prisma.crmNotification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        kind: 'web_lead',
        title: 'Nuevo interesado en Taxi Monterrico',
        body,
        notifType: 'lead',
        priority: 'alta',
        important: true,
        metadata: metadata as Prisma.InputJsonValue,
      })),
    });
    this.pingUsers(
      users.map((u) => u.id),
      'web_lead',
    );
  }

  async listForUser(userId: string, limit = 100): Promise<NotificationApiItem[]> {
    await this.syncTaskOverdueForUser(userId);
    const rows = await this.prisma.crmNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Math.max(1, limit)),
    });
    return rows.map((r) => this.toApiItem(r));
  }

  async markRead(userId: string, id: string): Promise<NotificationApiItem> {
    const row = await this.prisma.crmNotification.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('Notificación no encontrada');
    }
    const updated = await this.prisma.crmNotification.update({
      where: { id },
      data: { readAt: row.readAt ?? new Date() },
    });
    return this.toApiItem(updated);
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const res = await this.prisma.crmNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: res.count };
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.crmNotification.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('Notificación no encontrada');
    }
    await this.prisma.crmNotification.delete({ where: { id } });
  }
}
