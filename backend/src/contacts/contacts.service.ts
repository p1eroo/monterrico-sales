import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

const contactIncludeList = {
  companies: { include: { company: true } },
  user: { select: { id: true, name: true } },
} as const;

const contactIncludeDetail = {
  companies: { include: { company: true } },
  user: { select: { id: true, name: true } },
  contacts: {
    include: {
      linked: {
        include: {
          companies: { include: { company: true } },
        },
      },
    },
  },
  linkedBy: {
    include: {
      contact: {
        include: {
          companies: { include: { company: true } },
        },
      },
    },
  },
  opportunities: {
    include: {
      opportunity: {
        include: {
          user: { select: { id: true, name: true } },
          contacts: {
            take: 1,
            include: { contact: { select: { id: true, name: true } } },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertUserExists(id: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) {
      throw new BadRequestException('El usuario asignado no existe');
    }
  }

  async create(dto: CreateContactDto) {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    const phone = dto.phone?.trim();
    if (!phone) {
      throw new BadRequestException('El teléfono es obligatorio');
    }
    const email = dto.email?.trim();
    if (!email) {
      throw new BadRequestException('El email es obligatorio');
    }
    const source = dto.source?.trim();
    if (!source) {
      throw new BadRequestException('La fuente es obligatoria');
    }

    const assignedTo = dto.assignedTo?.trim() || null;
    if (assignedTo) {
      await this.assertUserExists(assignedTo);
    }

    const companyId = dto.companyId?.trim();
    if (companyId) {
      const comp = await this.prisma.company.findUnique({
        where: { id: companyId },
      });
      if (!comp) {
        throw new BadRequestException('La empresa indicada no existe');
      }
    }

    const etapa = dto.etapa?.trim() || 'lead';
    const today = new Date().toISOString().slice(0, 10);
    let etapaHistory: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
    if (dto.etapaHistory !== undefined && dto.etapaHistory !== null) {
      etapaHistory = dto.etapaHistory as Prisma.InputJsonValue;
    } else {
      etapaHistory = [{ etapa, fecha: today }] as unknown as Prisma.InputJsonValue;
    }

    const nextFollowUp =
      dto.nextFollowUp?.trim() != null && dto.nextFollowUp.trim() !== ''
        ? new Date(dto.nextFollowUp.trim())
        : null;
    if (nextFollowUp && Number.isNaN(nextFollowUp.getTime())) {
      throw new BadRequestException('Fecha de próximo seguimiento inválida');
    }

    const tags = Array.isArray(dto.tags) ? dto.tags.filter((t) => typeof t === 'string') : [];

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.contact.create({
        data: {
          name,
          phone,
          email,
          source,
          cargo: dto.cargo?.trim() || null,
          etapa,
          assignedTo,
          estimatedValue: dto.estimatedValue ?? 0,
          nextAction: dto.nextAction?.trim() || 'Contactar',
          nextFollowUp,
          notes: dto.notes?.trim() || null,
          tags,
          docType: dto.docType?.trim() || null,
          docNumber: dto.docNumber?.trim() || null,
          departamento: dto.departamento?.trim() || null,
          provincia: dto.provincia?.trim() || null,
          distrito: dto.distrito?.trim() || null,
          direccion: dto.direccion?.trim() || null,
          clienteRecuperado: dto.clienteRecuperado?.trim() || null,
          etapaHistory,
        },
      });

      if (companyId) {
        await tx.companyContact.create({
          data: {
            contactId: row.id,
            companyId,
            isPrimary: true,
          },
        });
      }

      return tx.contact.findUniqueOrThrow({
        where: { id: row.id },
        include: contactIncludeDetail,
      });
    });
  }

  findAll() {
    return this.prisma.contact.findMany({
      orderBy: { updatedAt: 'desc' },
      include: contactIncludeList,
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.contact.findUnique({
      where: { id },
      include: contactIncludeDetail,
    });
    if (!row) {
      throw new NotFoundException('Contacto no encontrado');
    }
    return row;
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.findOne(id);

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre no puede estar vacío');
      }
      data.name = name;
    }
    if (dto.phone !== undefined) {
      const phone = dto.phone.trim();
      if (!phone) {
        throw new BadRequestException('El teléfono no puede estar vacío');
      }
      data.phone = phone;
    }
    if (dto.email !== undefined) {
      const email = dto.email.trim();
      if (!email) {
        throw new BadRequestException('El email no puede estar vacío');
      }
      data.email = email;
    }
    if (dto.source !== undefined) {
      const source = dto.source.trim();
      if (!source) {
        throw new BadRequestException('La fuente no puede estar vacía');
      }
      data.source = source;
    }
    if (dto.cargo !== undefined) data.cargo = dto.cargo?.trim() || null;
    if (dto.etapa !== undefined) {
      const etapa = dto.etapa.trim();
      if (!etapa) {
        throw new BadRequestException('La etapa no puede estar vacía');
      }
      data.etapa = etapa;
    }
    if (dto.assignedTo !== undefined) {
      const assignedTo = dto.assignedTo?.trim() || null;
      if (assignedTo) {
        await this.assertUserExists(assignedTo);
      }
      data.assignedTo = assignedTo;
    }
    if (dto.estimatedValue !== undefined) {
      data.estimatedValue = dto.estimatedValue;
    }
    if (dto.nextAction !== undefined) {
      data.nextAction = dto.nextAction?.trim() || null;
    }
    if (dto.nextFollowUp !== undefined) {
      if (
        dto.nextFollowUp === null ||
        (typeof dto.nextFollowUp === 'string' && dto.nextFollowUp.trim() === '')
      ) {
        data.nextFollowUp = null;
      } else if (typeof dto.nextFollowUp === 'string') {
        const d = new Date(dto.nextFollowUp.trim());
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('Fecha de próximo seguimiento inválida');
        }
        data.nextFollowUp = d;
      }
    }
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.tags !== undefined) {
      data.tags = Array.isArray(dto.tags)
        ? dto.tags.filter((t) => typeof t === 'string')
        : [];
    }
    if (dto.docType !== undefined) data.docType = dto.docType?.trim() || null;
    if (dto.docNumber !== undefined) {
      data.docNumber = dto.docNumber?.trim() || null;
    }
    if (dto.departamento !== undefined) {
      data.departamento = dto.departamento?.trim() || null;
    }
    if (dto.provincia !== undefined) {
      data.provincia = dto.provincia?.trim() || null;
    }
    if (dto.distrito !== undefined) data.distrito = dto.distrito?.trim() || null;
    if (dto.direccion !== undefined) {
      data.direccion = dto.direccion?.trim() || null;
    }
    if (dto.clienteRecuperado !== undefined) {
      data.clienteRecuperado = dto.clienteRecuperado?.trim() || null;
    }
    if (dto.etapaHistory !== undefined) {
      data.etapaHistory =
        dto.etapaHistory === null
          ? Prisma.JsonNull
          : (dto.etapaHistory as Prisma.InputJsonValue);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    await this.prisma.contact.update({
      where: { id },
      data: data as Prisma.ContactUpdateInput,
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.contact.delete({
      where: { id },
    });
  }
}
