import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { EntitySyncService } from '../sync/entity-sync.service';
import { ClientsService } from '../clients/clients.service';
import { slugifyForUrl } from '../common/url-slug.util';
import { CrmConfigService } from '../crm-config/crm-config.service';

/** Select slim para listado: excluye linkedin, correo, direcciones */
const companySelectListSlim = {
  id: true,
  urlSlug: true,
  name: true,
  razonSocial: true,
  ruc: true,
  telefono: true,
  domain: true,
  rubro: true,
  tipo: true,
  facturacionEstimada: true,
  fuente: true,
  clienteRecuperado: true,
  etapa: true,
  assignedTo: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Listado con contactos para agregados (preview acotado en el mapper). */
const companySelectSummary = {
  ...companySelectListSlim,
  user: { select: { id: true, name: true } },
  contacts: {
    select: {
      contact: {
        select: {
          id: true,
          urlSlug: true,
          name: true,
          correo: true,
          etapa: true,
          fuente: true,
          assignedTo: true,
          estimatedValue: true,
          clienteRecuperado: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

type CompanySummaryDbRow = Prisma.CompanyGetPayload<{
  select: typeof companySelectSummary;
}>;

const CONTACTS_PREVIEW_MAX = 80;

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitySync: EntitySyncService,
    private readonly clientsService: ClientsService,
    private readonly crmConfig: CrmConfigService,
  ) {}

  private async assertUserExists(id: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) {
      throw new BadRequestException('El usuario asignado no existe');
    }
  }

  private async allocateCompanyUrlSlug(
    nameSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyForUrl(nameSource);
    let candidate = base;
    let n = 0;
    for (;;) {
      const found = await this.prisma.company.findFirst({
        where: {
          urlSlug: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
      });
      if (!found) return candidate;
      n += 1;
      candidate = `${base}-${n}`;
    }
  }

  private async resolveCompanyId(param: string): Promise<string> {
    const raw = param.trim();
    if (!raw) {
      throw new NotFoundException('Empresa no encontrada');
    }
    const byId = await this.prisma.company.findUnique({
      where: { id: raw },
      select: { id: true },
    });
    if (byId) return byId.id;
    let slug = raw;
    try {
      slug = decodeURIComponent(raw);
    } catch {
      /* usar raw */
    }
    const bySlug = await this.prisma.company.findUnique({
      where: { urlSlug: slug },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;
    throw new NotFoundException('Empresa no encontrada');
  }

  async create(dto: CreateCompanyDto) {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre de la empresa es obligatorio');
    }

    if (
      dto.facturacionEstimada === undefined ||
      dto.facturacionEstimada === null ||
      Number.isNaN(dto.facturacionEstimada) ||
      dto.facturacionEstimada <= 0
    ) {
      throw new BadRequestException(
        'La facturación estimada es obligatoria y debe ser mayor que 0',
      );
    }

    const fuente = dto.fuente?.trim();
    if (!fuente) {
      throw new BadRequestException('La fuente es obligatoria');
    }

    const etapa = dto.etapa?.trim() || 'lead';
    const assignedTo = dto.assignedTo?.trim() || null;
    if (assignedTo) {
      await this.assertUserExists(assignedTo);
    }
    await this.crmConfig.assertEtapaAssignable(etapa);

    const dupName = await this.prisma.company.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (dupName) {
      throw new BadRequestException(
        'Ya existe una empresa con el mismo nombre. Revisa o elige otro nombre.',
      );
    }

    const rucTrim = dto.ruc?.trim();
    if (rucTrim) {
      const dupRuc = await this.prisma.company.findFirst({
        where: { ruc: rucTrim },
      });
      if (dupRuc) {
        throw new BadRequestException(
          'Ya existe una empresa registrada con el mismo RUC.',
        );
      }
    }

    const urlSlug = await this.allocateCompanyUrlSlug(name);
    const company = await this.prisma.company.create({
      data: {
        urlSlug,
        name,
        razonSocial: dto.razonSocial?.trim() || null,
        ruc: rucTrim || null,
        telefono: dto.telefono?.trim() || null,
        domain: dto.domain?.trim() || null,
        rubro: dto.rubro?.trim() || null,
        tipo: dto.tipo?.trim() || null,
        linkedin: dto.linkedin?.trim() || null,
        correo: dto.correo?.trim() || null,
        distrito: dto.distrito?.trim() || null,
        provincia: dto.provincia?.trim() || null,
        departamento: dto.departamento?.trim() || null,
        direccion: dto.direccion?.trim() || null,
        facturacionEstimada: dto.facturacionEstimada,
        fuente,
        clienteRecuperado: dto.clienteRecuperado?.trim() || null,
        etapa,
        assignedTo,
      },
    });

    await this.entitySync.propagateFromCompany(company.id);
    await this.clientsService.ensureClientForCierreGanado(company.id);
    return this.findOne(company.id);
  }

  async findAll(opts?: {
    page?: number;
    limit?: number;
    search?: string;
    rubro?: string;
    tipo?: string;
  }) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(5000, Math.max(1, opts?.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {};
    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { razonSocial: { contains: q, mode: 'insensitive' } },
        { ruc: { contains: q } },
        { domain: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (opts?.rubro?.trim()) where.rubro = opts.rubro.trim();
    if (opts?.tipo?.trim()) where.tipo = opts.tipo.trim();

    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: companySelectListSlim,
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Listado paginado con agregados por empresa (sin cargar todos los contactos en el cliente).
   * Filtro por etapa: empresas con al menos un contacto en esa etapa (no coincide siempre con la etapa “display” por peso).
   */
  async findAllSummary(opts?: {
    page?: number;
    limit?: number;
    search?: string;
    rubro?: string;
    tipo?: string;
    etapa?: string;
    fuente?: string;
    assignedTo?: string;
  }) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(5000, Math.max(1, opts?.limit ?? 25));
    const skip = (page - 1) * limit;

    const andParts: Prisma.CompanyWhereInput[] = [];

    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      andParts.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { razonSocial: { contains: q, mode: 'insensitive' } },
          { ruc: { contains: q } },
          { domain: { contains: q, mode: 'insensitive' } },
          {
            contacts: {
              some: {
                contact: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { correo: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ],
      });
    }
    if (opts?.rubro?.trim()) andParts.push({ rubro: opts.rubro.trim() });
    if (opts?.tipo?.trim()) andParts.push({ tipo: opts.tipo.trim() });
    const etapaQ = opts?.etapa?.trim();
    if (etapaQ) {
      andParts.push({
        OR: [
          { etapa: etapaQ },
          {
            contacts: {
              some: { contact: { etapa: etapaQ } },
            },
          },
        ],
      });
    }
    const fuenteQ = opts?.fuente?.trim();
    if (fuenteQ) {
      andParts.push({
        OR: [
          { fuente: fuenteQ },
          {
            contacts: {
              some: { contact: { fuente: fuenteQ } },
            },
          },
        ],
      });
    }
    const advQ = opts?.assignedTo?.trim();
    if (advQ) {
      andParts.push({
        OR: [
          { assignedTo: advQ },
          {
            contacts: {
              some: { contact: { assignedTo: advQ } },
            },
          },
        ],
      });
    }

    const where: Prisma.CompanyWhereInput =
      andParts.length > 0 ? { AND: andParts } : {};

    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: companySelectSummary,
      }),
      this.prisma.company.count({ where }),
    ]);

    const data = rows.map((row) => this.mapCompanySummaryRow(row));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private mapCompanySummaryRow(row: CompanySummaryDbRow) {
    const contacts = row.contacts.map((cc) => cc.contact);
    const { contacts: _omit, user: companyUser, ...rest } = row;

    let clienteRecuperado: 'si' | 'no' | null =
      (rest.clienteRecuperado === 'si' || rest.clienteRecuperado === 'no'
        ? rest.clienteRecuperado
        : null) as 'si' | 'no' | null;
    if (clienteRecuperado == null) {
      if (contacts.some((c) => c.clienteRecuperado === 'si')) {
        clienteRecuperado = 'si';
      } else if (contacts.some((c) => c.clienteRecuperado === 'no')) {
        clienteRecuperado = 'no';
      }
    }

    const preview = contacts
      .slice(0, CONTACTS_PREVIEW_MAX)
      .map((c) => ({ id: c.id, name: c.name, urlSlug: c.urlSlug }));

    const contactCount = contacts.length;

    return {
      id: rest.id,
      urlSlug: rest.urlSlug,
      name: rest.name,
      razonSocial: rest.razonSocial,
      ruc: rest.ruc,
      telefono: rest.telefono,
      domain: rest.domain,
      rubro: rest.rubro,
      tipo: rest.tipo,
      facturacionEstimada: rest.facturacionEstimada,
      fuente: rest.fuente,
      etapa: rest.etapa,
      assignedTo: rest.assignedTo,
      createdAt: rest.createdAt,
      updatedAt: rest.updatedAt,
      contactCount,
      totalEstimatedValue: rest.facturacionEstimada,
      displayEtapa: rest.etapa,
      displayFuente: rest.fuente,
      displayAdvisorUserId: rest.assignedTo ?? companyUser?.id ?? null,
      displayAdvisorName: companyUser?.name ?? null,
      clienteRecuperado,
      contactsPreview: preview,
    };
  }

  async findOne(idOrSlug: string) {
    const id = await this.resolveCompanyId(idOrSlug);
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }
    return company;
  }

  async update(idOrSlug: string, dto: UpdateCompanyDto) {
    const id = await this.resolveCompanyId(idOrSlug);
    await this.findOne(id);

    const data: Record<string, string | number | null | undefined> = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre no puede estar vacío');
      }
      data.name = name;
      data.urlSlug = await this.allocateCompanyUrlSlug(name, id);
    }
    if (dto.razonSocial !== undefined) {
      data.razonSocial = dto.razonSocial?.trim() || null;
    }
    if (dto.ruc !== undefined) data.ruc = dto.ruc?.trim() || null;
    if (dto.telefono !== undefined) data.telefono = dto.telefono?.trim() || null;
    if (dto.domain !== undefined) data.domain = dto.domain?.trim() || null;
    if (dto.rubro !== undefined) data.rubro = dto.rubro?.trim() || null;
    if (dto.tipo !== undefined) data.tipo = dto.tipo?.trim() || null;
    if (dto.linkedin !== undefined) data.linkedin = dto.linkedin?.trim() || null;
    if (dto.correo !== undefined) data.correo = dto.correo?.trim() || null;
    if (dto.distrito !== undefined) data.distrito = dto.distrito?.trim() || null;
    if (dto.provincia !== undefined) data.provincia = dto.provincia?.trim() || null;
    if (dto.departamento !== undefined) {
      data.departamento = dto.departamento?.trim() || null;
    }
    if (dto.direccion !== undefined) data.direccion = dto.direccion?.trim() || null;

    if (dto.facturacionEstimada !== undefined) {
      if (
        dto.facturacionEstimada === null ||
        Number.isNaN(dto.facturacionEstimada) ||
        dto.facturacionEstimada <= 0
      ) {
        throw new BadRequestException(
          'La facturación estimada debe ser mayor que 0',
        );
      }
      data.facturacionEstimada = dto.facturacionEstimada;
    }
    if (dto.fuente !== undefined) {
      const s = dto.fuente?.trim();
      if (!s) {
        throw new BadRequestException('La fuente no puede estar vacía');
      }
      data.fuente = s;
    }
    if (dto.clienteRecuperado !== undefined) {
      data.clienteRecuperado = dto.clienteRecuperado?.trim() || null;
    }
    if (dto.etapa !== undefined) {
      const e = dto.etapa?.trim();
      if (!e) {
        throw new BadRequestException('La etapa no puede estar vacía');
      }
      await this.crmConfig.assertEtapaAssignable(e);
      data.etapa = e;
    }
    if (dto.assignedTo !== undefined) {
      const a = dto.assignedTo?.trim() || null;
      if (a) {
        await this.assertUserExists(a);
      }
      data.assignedTo = a;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    await this.prisma.company.update({
      where: { id },
      data: data as Prisma.CompanyUpdateInput,
    });

    const touchedCommercial =
      dto.facturacionEstimada !== undefined ||
      dto.fuente !== undefined ||
      dto.clienteRecuperado !== undefined ||
      dto.etapa !== undefined ||
      dto.assignedTo !== undefined;
    if (touchedCommercial) {
      await this.entitySync.propagateFromCompany(id);
    }

    await this.clientsService.ensureClientForCierreGanado(id);

    return this.findOne(id);
  }

  async remove(idOrSlug: string) {
    const id = await this.resolveCompanyId(idOrSlug);
    await this.findOne(id);
    return this.prisma.company.delete({
      where: { id },
    });
  }
}
