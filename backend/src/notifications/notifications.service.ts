import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationApiItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  type: string;
  priority: string;
  important: boolean;
  contactId?: string;
  opportunityId?: string;
  activityId?: string;
};

type NotificationMeta = {
  contactId?: string;
  opportunityId?: string;
  activityId?: string;
};

function parseMeta(raw: Prisma.JsonValue | null | undefined): NotificationMeta {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const contactId = typeof o.contactId === 'string' ? o.contactId : undefined;
  const opportunityId =
    typeof o.opportunityId === 'string' ? o.opportunityId : undefined;
  const activityId = typeof o.activityId === 'string' ? o.activityId : undefined;
  return { contactId, opportunityId, activityId };
}

const PEN_FMT = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  maximumFractionDigits: 0,
});

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toApiItem(row: {
    id: string;
    title: string;
    body: string;
    readAt: Date | null;
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
