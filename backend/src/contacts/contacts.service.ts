import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { EntitySyncService } from '../sync/entity-sync.service';

const contactIncludeList = {
  companies: { include: { company: true } },
  user: { select: { id: true, name: true } },
} as const;

/** Select explícito para listado: solo campos necesarios (sin etapaHistory, notes, doc, direcciones).
 *  Omite redundancias: companyId (=company.id), assignedTo (=user.id) */
const contactSelectListSlim = {
  id: true,
  name: true,
  cargo: true,
  telefono: true,
  correo: true,
  fuente: true,
  etapa: true,
  estimatedValue: true,
  nextAction: true,
  nextFollowUp: true,
  clienteRecuperado: true,
  createdAt: true,
  updatedAt: true,
  companies: {
    select: {
      id: true,
      isPrimary: true,
      company: { select: { id: true, name: true } },
    },
  },
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitySync: EntitySyncService,
  ) {}

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
    const telefono = dto.telefono?.trim();
    if (!telefono) {
      throw new BadRequestException('El teléfono es obligatorio');
    }
    const correo = dto.correo?.trim();
    if (!correo) {
      throw new BadRequestException('El correo es obligatorio');
    }
    const fuente = dto.fuente?.trim();
    if (!fuente) {
      throw new BadRequestException('La fuente es obligatoria');
    }

    if (
      dto.estimatedValue === undefined ||
      dto.estimatedValue === null ||
      Number.isNaN(dto.estimatedValue) ||
      dto.estimatedValue <= 0
    ) {
      throw new BadRequestException(
        'El valor estimado es obligatorio y debe ser mayor que 0',
      );
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

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: {
          name,
          telefono,
          correo,
          fuente,
          cargo: dto.cargo?.trim() || null,
          etapa,
          assignedTo,
          estimatedValue: dto.estimatedValue,
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
            contactId: created.id,
            companyId,
            isPrimary: true,
          },
        });
      }

      return created;
    });

    if (companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      const expectedClose = new Date();
      expectedClose.setDate(expectedClose.getDate() + 30);
      await this.entitySync.ensureOpportunityForContactCompany(
        row.id,
        companyId,
        {
          title: company?.name
            ? `${name} · ${company.name}`
            : name,
          amount: dto.estimatedValue!,
          etapa,
          fuente,
          assignedTo,
          expectedCloseDate: expectedClose,
        },
      );
      await this.entitySync.propagateFromContact(companyId, row.id);
    }

    return this.findOne(row.id);
  }

  async findAll(opts?: {
    page?: number;
    limit?: number;
    search?: string;
    etapa?: string;
    fuente?: string;
    assignedTo?: string;
  }) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(5000, Math.max(1, opts?.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = {};
    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { correo: { contains: q, mode: 'insensitive' } },
        { telefono: { contains: q } },
        { cargo: { contains: q, mode: 'insensitive' } },
        {
          companies: {
            some: {
              company: {
                name: { contains: q, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }
    if (opts?.etapa?.trim()) where.etapa = opts.etapa.trim();
    if (opts?.fuente?.trim()) where.fuente = opts.fuente.trim();
    if (opts?.assignedTo?.trim()) where.assignedTo = opts.assignedTo.trim();

    const [rows, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: contactSelectListSlim,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
    if (dto.telefono !== undefined) {
      const telefono = dto.telefono.trim();
      if (!telefono) {
        throw new BadRequestException('El teléfono no puede estar vacío');
      }
      data.telefono = telefono;
    }
    if (dto.correo !== undefined) {
      const correo = dto.correo.trim();
      if (!correo) {
        throw new BadRequestException('El correo no puede estar vacío');
      }
      data.correo = correo;
    }
    if (dto.fuente !== undefined) {
      const fuente = dto.fuente.trim();
      if (!fuente) {
        throw new BadRequestException('La fuente no puede estar vacía');
      }
      data.fuente = fuente;
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
      if (
        dto.estimatedValue === null ||
        Number.isNaN(dto.estimatedValue) ||
        dto.estimatedValue <= 0
      ) {
        throw new BadRequestException(
          'El valor estimado debe ser mayor que 0',
        );
      }
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

    const links = await this.prisma.companyContact.findMany({
      where: { contactId: id },
      select: { companyId: true },
    });
    for (const { companyId } of links) {
      await this.entitySync.propagateFromContact(companyId, id);
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.contact.delete({
      where: { id },
    });
  }

  async addCompany(contactId: string, companyId: string, isPrimary = false) {
    await this.findOne(contactId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new BadRequestException('La empresa no existe');
    }
    const existing = await this.prisma.companyContact.findUnique({
      where: {
        companyId_contactId: { companyId, contactId },
      },
    });
    if (existing) {
      throw new BadRequestException('El contacto ya está vinculado a esta empresa');
    }
    await this.prisma.companyContact.create({
      data: { contactId, companyId, isPrimary },
    });
    await this.entitySync.propagateFromContact(companyId, contactId);
    return this.findOne(contactId);
  }

  async removeCompany(contactId: string, companyId: string) {
    await this.findOne(contactId);
    const deleted = await this.prisma.companyContact.deleteMany({
      where: { contactId, companyId },
    });
    if (deleted.count === 0) {
      throw new BadRequestException('El vínculo no existe');
    }
    return this.findOne(contactId);
  }

  async addLinkedContact(contactId: string, linkedContactId: string) {
    if (contactId === linkedContactId) {
      throw new BadRequestException('Un contacto no puede vincularse consigo mismo');
    }
    await this.findOne(contactId);
    const linked = await this.prisma.contact.findUnique({
      where: { id: linkedContactId },
    });
    if (!linked) {
      throw new BadRequestException('El contacto a vincular no existe');
    }
    const existing = await this.prisma.contactContact.findUnique({
      where: {
        contactId_linkedId: { contactId, linkedId: linkedContactId },
      },
    });
    if (existing) {
      throw new BadRequestException('Los contactos ya están vinculados');
    }
    await this.prisma.contactContact.create({
      data: { contactId, linkedId: linkedContactId },
    });
    return this.findOne(contactId);
  }

  async removeLinkedContact(contactId: string, linkedId: string) {
    await this.findOne(contactId);
    const deleted = await this.prisma.contactContact.deleteMany({
      where: { contactId, linkedId },
    });
    if (deleted.count === 0) {
      throw new BadRequestException('El vínculo no existe');
    }
    return this.findOne(contactId);
  }
}
