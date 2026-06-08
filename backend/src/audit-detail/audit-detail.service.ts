import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { ActivityActor } from '../activity-logs/activity-logs.types';
import type { AuditDiffEntry } from '../common/audit-diff.util';

@Injectable()
export class AuditDetailService {
  private readonly logger = new Logger(AuditDetailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    actor: ActivityActor | null,
    opts: {
      action: string;
      module: string;
      entityType: string;
      entityId: string;
      entityName?: string | null;
      entries: AuditDiffEntry[];
    },
  ): Promise<void> {
    if (opts.entries.length === 0) {
      return;
    }
    try {
      await this.prisma.auditChangeSet.create({
        data: {
          userId: actor?.userId ?? null,
          userName: actor?.userName ?? 'Sistema',
          action: opts.action,
          module: opts.module,
          entityType: opts.entityType,
          entityId: opts.entityId,
          entityName: opts.entityName ?? null,
          entries: {
            create: opts.entries.map((e) => ({
              fieldKey: e.fieldKey,
              fieldLabel: e.fieldLabel,
              oldValue: e.oldValue,
              newValue: e.newValue,
            })),
          },
        },
      });
    } catch (e) {
      this.logger.warn(`No se pudo registrar AuditChangeSet: ${e}`);
    }
  }

  async findPage(opts: {
    page: number;
    limit: number;
    search?: string;
    userId?: string;
    module?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
  }) {
    const page = Math.max(1, opts.page);
    const limit = Math.min(100, Math.max(1, opts.limit));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditChangeSetWhereInput = {};

    if (opts.userId) {
      where.userId = opts.userId;
    }
    if (opts.module) {
      where.module = opts.module;
    }
    if (opts.action) {
      where.action = opts.action;
    }
    if (opts.entityType?.trim() && opts.entityId?.trim()) {
      where.entityType = opts.entityType.trim();
      where.entityId = opts.entityId.trim();
    }

    if (opts.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { entityName: { contains: q, mode: 'insensitive' } },
        { userName: { contains: q, mode: 'insensitive' } },
        {
          entries: {
            some: {
              OR: [
                { fieldLabel: { contains: q, mode: 'insensitive' } },
                { oldValue: { contains: q, mode: 'insensitive' } },
                { newValue: { contains: q, mode: 'insensitive' } },
                { fieldKey: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditChangeSet.findMany({
        where,
        include: {
          entries: { orderBy: { fieldKey: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditChangeSet.count({ where }),
    ]);

    const ts = (d: Date) => d.toISOString();

    return {
      data: rows.map((r) => ({
        id: r.id,
        userId: r.userId ?? '',
        userName: r.userName,
        entityType: r.entityType,
        entityId: r.entityId,
        entityName: r.entityName ?? '',
        action: r.action,
        timestamp: ts(r.createdAt),
        entries: r.entries.map((e) => ({
          id: e.id,
          userId: r.userId ?? '',
          userName: r.userName,
          entityType: r.entityType,
          entityId: r.entityId,
          entityName: r.entityName ?? '',
          fieldChanged: e.fieldLabel,
          oldValue: e.oldValue,
          newValue: e.newValue,
          timestamp: ts(r.createdAt),
          actionId: r.id,
        })),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }
}
