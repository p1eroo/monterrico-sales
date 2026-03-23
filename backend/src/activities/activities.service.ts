import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

const activityInclude = {
  user: { select: { id: true, name: true } },
  contacts: { include: { contact: { select: { id: true, name: true } } } },
  companies: { include: { company: { select: { id: true, name: true } } } },
  opportunities: {
    include: {
      opportunity: { select: { id: true, title: true } },
    },
  },
} as const;

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(s: string | null | undefined): Date | null {
    if (!s || typeof s !== 'string') return null;
    const d = new Date(s.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }

  async create(dto: CreateActivityDto) {
    const type = dto.type?.trim();
    if (!type) {
      throw new BadRequestException('El tipo es obligatorio');
    }
    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException('El título es obligatorio');
    }
    const assignedTo = dto.assignedTo?.trim();
    if (!assignedTo) {
      throw new BadRequestException('El asignado es obligatorio');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: assignedTo },
    });
    if (!user) {
      throw new BadRequestException('El usuario asignado no existe');
    }
    const dueDate = this.parseDate(dto.dueDate);
    if (!dueDate) {
      throw new BadRequestException('La fecha de vencimiento es obligatoria');
    }
    const startDate = this.parseDate(dto.startDate);
    const contactId = dto.contactId?.trim();
    const companyId = dto.companyId?.trim();
    const opportunityId = dto.opportunityId?.trim();
    if (!contactId && !companyId && !opportunityId) {
      throw new BadRequestException(
        'Debe vincularse a al menos un contacto, empresa u oportunidad',
      );
    }
    if (contactId) {
      const c = await this.prisma.contact.findUnique({
        where: { id: contactId },
      });
      if (!c) {
        throw new BadRequestException('El contacto indicado no existe');
      }
    }
    if (companyId) {
      const c = await this.prisma.company.findUnique({
        where: { id: companyId },
      });
      if (!c) {
        throw new BadRequestException('La empresa indicada no existe');
      }
    }
    if (opportunityId) {
      const o = await this.prisma.opportunity.findUnique({
        where: { id: opportunityId },
      });
      if (!o) {
        throw new BadRequestException('La oportunidad indicada no existe');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          type,
          title,
          description: dto.description?.trim() ?? '',
          assignedTo,
          status: 'pendiente',
          dueDate,
          startDate,
          startTime: dto.startTime?.trim() || null,
        },
      });
      if (contactId) {
        await tx.contactActivity.create({
          data: { contactId, activityId: activity.id },
        });
      }
      if (companyId) {
        await tx.companyActivity.create({
          data: { companyId, activityId: activity.id },
        });
      }
      if (opportunityId) {
        await tx.opportunityActivity.create({
          data: { opportunityId, activityId: activity.id },
        });
      }
      return tx.activity.findUniqueOrThrow({
        where: { id: activity.id },
        include: activityInclude,
      });
    });
  }

  findAll() {
    return this.prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      include: activityInclude,
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.activity.findUnique({
      where: { id },
      include: activityInclude,
    });
    if (!row) {
      throw new NotFoundException('Actividad no encontrada');
    }
    return row;
  }

  async update(id: string, dto: UpdateActivityDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.type !== undefined) {
      const t = dto.type?.trim();
      if (!t) throw new BadRequestException('El tipo no puede estar vacío');
      data.type = t;
    }
    if (dto.title !== undefined) {
      const t = dto.title?.trim();
      if (!t) throw new BadRequestException('El título no puede estar vacío');
      data.title = t;
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() ?? '';
    }
    if (dto.assignedTo !== undefined) {
      const a = dto.assignedTo?.trim();
      if (a) {
        const u = await this.prisma.user.findUnique({ where: { id: a } });
        if (!u) throw new BadRequestException('El usuario asignado no existe');
      }
      data.assignedTo = a || undefined;
    }
    if (dto.status !== undefined) {
      const s = dto.status?.trim();
      if (s) data.status = s;
    }
    if (dto.dueDate !== undefined) {
      const d = this.parseDate(dto.dueDate);
      if (d) data.dueDate = d;
    }
    if (dto.startDate !== undefined) {
      data.startDate = this.parseDate(dto.startDate);
    }
    if (dto.startTime !== undefined) {
      data.startTime = dto.startTime?.trim() || null;
    }
    if ('completedAt' in dto && dto.completedAt !== undefined) {
      data.completedAt = this.parseDate(String(dto.completedAt));
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }
    await this.prisma.activity.update({
      where: { id },
      data: data as Record<string, unknown>,
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.activity.delete({
      where: { id },
    });
  }
}
