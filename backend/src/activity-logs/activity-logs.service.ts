import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { ActivityActor, RecordActivityInput } from './activity-logs.types';

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    actor: ActivityActor | null,
    input: RecordActivityInput,
  ): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: actor?.userId ?? null,
          userName: actor?.userName ?? 'Sistema',
          action: input.action,
          module: input.module,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          entityName: input.entityName ?? null,
          description: input.description,
          status: input.status ?? 'exito',
          isCritical: input.isCritical ?? false,
        },
      });
    } catch (e) {
      this.logger.warn(`No se pudo registrar ActivityLog: ${e}`);
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

    const where: Prisma.ActivityLogWhereInput = {};

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
        { userName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { entityName: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        userId: r.userId ?? '',
        userName: r.userName,
        action: r.action,
        module: r.module,
        entityType: r.entityType,
        entityId: r.entityId ?? undefined,
        entityName: r.entityName ?? undefined,
        description: r.description,
        timestamp: r.createdAt.toISOString(),
        status: r.status as 'exito' | 'fallido' | 'pendiente',
        isCritical: r.isCritical,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }
}
