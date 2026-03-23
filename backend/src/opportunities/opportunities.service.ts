import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

/** Misma lógica que el mock del frontend (`etapaProbabilidad`) */
const ETAPA_PROBABILITY: Record<string, number> = {
  lead: 0,
  contacto: 10,
  reunion_agendada: 30,
  reunion_efectiva: 40,
  propuesta_economica: 50,
  negociacion: 70,
  licitacion: 75,
  licitacion_etapa_final: 85,
  cierre_ganado: 90,
  firma_contrato: 95,
  activo: 100,
  cierre_perdido: -1,
  inactivo: -5,
};

/** Estados de pipeline derivados de la etapa (no se usa `suspendida`). */
type PipelineOpportunityStatus = 'abierta' | 'ganada' | 'perdida';

const opportunityIncludeList = {
  contacts: {
    take: 1,
    include: { contact: { select: { id: true, name: true } } },
  },
  user: { select: { id: true, name: true } },
} as const;

const opportunityIncludeDetail = {
  contacts: { include: { contact: true } },
  companies: { include: { company: true } },
  user: { select: { id: true, name: true } },
} as const;

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private probabilityForEtapa(etapa: string, explicit?: number): number {
    if (explicit !== undefined && Number.isFinite(explicit)) {
      return Math.round(explicit);
    }
    return ETAPA_PROBABILITY[etapa] ?? 0;
  }

  private normalizePriority(raw?: string): string {
    const p = raw?.trim().toLowerCase();
    if (p === 'baja' || p === 'media' || p === 'alta') {
      return p;
    }
    return 'media';
  }

  /** Deriva estado comercial solo a partir de la etapa (abierta | ganada | perdida). */
  private statusFromEtapa(etapa: string): PipelineOpportunityStatus {
    if (['activo', 'cierre_ganado', 'firma_contrato'].includes(etapa)) {
      return 'ganada';
    }
    if (['cierre_perdido', 'inactivo'].includes(etapa)) {
      return 'perdida';
    }
    return 'abierta';
  }

  /** PATCH explícito de `status` sin cambiar etapa: solo abierta | ganada | perdida. */
  private normalizeManualStatus(raw: string): PipelineOpportunityStatus {
    const s = raw.trim().toLowerCase();
    if (s === 'ganada' || s === 'perdida' || s === 'abierta') {
      return s;
    }
    return 'abierta';
  }

  private async assertUserExists(id: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) {
      throw new BadRequestException('El usuario asignado no existe');
    }
  }

  async create(dto: CreateOpportunityDto) {
    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException('El título es obligatorio');
    }
    if (dto.amount === undefined || dto.amount === null || Number.isNaN(dto.amount)) {
      throw new BadRequestException('El monto es obligatorio');
    }
    if (dto.amount < 0) {
      throw new BadRequestException('El monto no puede ser negativo');
    }
    const etapa = dto.etapa?.trim();
    if (!etapa) {
      throw new BadRequestException('La etapa es obligatoria');
    }

    const assignedTo = dto.assignedTo?.trim() || null;
    if (assignedTo) {
      await this.assertUserExists(assignedTo);
    }

    if (dto.contactId?.trim()) {
      const c = await this.prisma.contact.findUnique({
        where: { id: dto.contactId.trim() },
      });
      if (!c) {
        throw new BadRequestException('El contacto indicado no existe');
      }
    }

    if (dto.companyId?.trim()) {
      const comp = await this.prisma.company.findUnique({
        where: { id: dto.companyId.trim() },
      });
      if (!comp) {
        throw new BadRequestException('La empresa indicada no existe');
      }
    }

    const probability = this.probabilityForEtapa(etapa, dto.probability);
    const priority = this.normalizePriority(dto.priority);
    const status = this.statusFromEtapa(etapa);
    const expectedCloseDate =
      dto.expectedCloseDate?.trim() != null && dto.expectedCloseDate.trim() !== ''
        ? new Date(dto.expectedCloseDate.trim())
        : null;
    if (expectedCloseDate && Number.isNaN(expectedCloseDate.getTime())) {
      throw new BadRequestException('Fecha de cierre inválida');
    }

    const contactId = dto.contactId?.trim();
    const companyId = dto.companyId?.trim();

    return this.prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.create({
        data: {
          title,
          amount: dto.amount,
          probability,
          etapa,
          status,
          priority,
          expectedCloseDate,
          assignedTo,
        },
      });

      if (contactId) {
        await tx.contactOpportunity.create({
          data: { contactId, opportunityId: opp.id },
        });
      }
      if (companyId) {
        await tx.companyOpportunity.create({
          data: { companyId, opportunityId: opp.id },
        });
      }

      return tx.opportunity.findUniqueOrThrow({
        where: { id: opp.id },
        include: opportunityIncludeDetail,
      });
    });
  }

  findAll() {
    return this.prisma.opportunity.findMany({
      orderBy: { updatedAt: 'desc' },
      include: opportunityIncludeList,
    });
  }

  async findOne(id: string) {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id },
      include: opportunityIncludeDetail,
    });
    if (!opp) {
      throw new NotFoundException('Oportunidad no encontrada');
    }
    return opp;
  }

  async update(id: string, dto: UpdateOpportunityDto) {
    await this.findOne(id);

    const data: Record<string, string | number | Date | null | undefined> = {};

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) {
        throw new BadRequestException('El título no puede estar vacío');
      }
      data.title = title;
    }
    if (dto.amount !== undefined) {
      if (dto.amount < 0) {
        throw new BadRequestException('El monto no puede ser negativo');
      }
      data.amount = dto.amount;
    }
    if (dto.etapa !== undefined) {
      const etapa = dto.etapa.trim();
      if (!etapa) {
        throw new BadRequestException('La etapa no puede estar vacía');
      }
      data.etapa = etapa;
      if (dto.probability === undefined) {
        data.probability = this.probabilityForEtapa(etapa);
      }
      data.status = this.statusFromEtapa(etapa);
    }
    if (dto.probability !== undefined) {
      data.probability = Math.round(dto.probability);
    }
    if (dto.status !== undefined && dto.etapa === undefined) {
      data.status = this.normalizeManualStatus(dto.status);
    }
    if (dto.expectedCloseDate !== undefined) {
      if (
        dto.expectedCloseDate === null ||
        (typeof dto.expectedCloseDate === 'string' && dto.expectedCloseDate.trim() === '')
      ) {
        data.expectedCloseDate = null;
      } else if (typeof dto.expectedCloseDate === 'string') {
        const d = new Date(dto.expectedCloseDate.trim());
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('Fecha de cierre inválida');
        }
        data.expectedCloseDate = d;
      }
    }
    if (dto.assignedTo !== undefined) {
      const assignedTo = dto.assignedTo?.trim() || null;
      if (assignedTo) {
        await this.assertUserExists(assignedTo);
      }
      data.assignedTo = assignedTo;
    }
    if (dto.priority !== undefined) {
      data.priority = this.normalizePriority(dto.priority);
    }

    const hasContactLinkUpdate = dto.contactId !== undefined;

    if (Object.keys(data).length === 0 && !hasContactLinkUpdate) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.opportunity.update({
        where: { id },
        data,
      });
    }

    if (hasContactLinkUpdate) {
      const raw = dto.contactId;
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        await this.prisma.contactOpportunity.deleteMany({
          where: { opportunityId: id },
        });
      } else {
        if (typeof raw !== 'string') {
          throw new BadRequestException('contactId debe ser un string');
        }
        const cid = raw.trim();
        const c = await this.prisma.contact.findUnique({ where: { id: cid } });
        if (!c) {
          throw new BadRequestException('El contacto no existe');
        }
        await this.prisma.$transaction(async (tx) => {
          await tx.contactOpportunity.deleteMany({
            where: { opportunityId: id },
          });
          await tx.contactOpportunity.create({
            data: { contactId: cid, opportunityId: id },
          });
        });
      }
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.opportunity.delete({
      where: { id },
    });
  }
}
