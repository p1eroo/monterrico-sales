import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateCompanyDto } from '../companies/dto/create-company.dto';
import { EntitySyncService } from '../sync/entity-sync.service';
import { slugifyForUrl } from '../common/url-slug.util';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import type { ActivityActor } from '../activity-logs/activity-logs.types';
import { AuditDetailService } from '../audit-detail/audit-detail.service';
import { buildChangeEntries } from '../common/audit-diff.util';
import { CONTACT_FIELD_LABELS } from '../audit-detail/audit-field-labels';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';
import { NotificationsService } from '../notifications/notifications.service';

/** Orden de pestañas de etapa en listado contactos (alineado con Empresas). */
const CONTACT_TAB_ETAPAS = [
  'lead',
  'contacto',
  'reunion_agendada',
  'reunion_efectiva',
  'propuesta_economica',
  'negociacion',
  'licitacion',
  'licitacion_etapa_final',
  'cierre_ganado',
  'firma_contrato',
  'activo',
  'cierre_perdido',
  'inactivo',
] as const;

const contactIncludeList = {
  companies: { include: { company: true } },
  user: { select: { id: true, name: true } },
} as const;

/** Select explícito para listado: solo campos necesarios (sin etapaHistory, doc, direcciones).
 *  Omite redundancias: companyId (=company.id), assignedTo (=user.id) */
const contactSelectListSlim = {
  id: true,
  urlSlug: true,
  name: true,
  cargo: true,
  telefono: true,
  correo: true,
  fuente: true,
  etapa: true,
  estimatedValue: true,
  clienteRecuperado: true,
  createdAt: true,
  updatedAt: true,
  companies: {
    select: {
      id: true,
      isPrimary: true,
      company: { select: { id: true, urlSlug: true, name: true } },
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
    private readonly crmConfig: CrmConfigService,
    private readonly activityLogs: ActivityLogsService,
    private readonly auditDetail: AuditDetailService,
    private readonly notifications: NotificationsService,
  ) {}

  private async assertUserExists(id: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) {
      throw new BadRequestException('El usuario asignado no existe');
    }
  }

  /** Alta de empresa dentro de una transacción (sin propagate; el contacto vinculado lo dispara después). */
  private async allocateContactUrlSlugTx(
    tx: Prisma.TransactionClient,
    nameSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyForUrl(nameSource);
    let candidate = base;
    let n = 0;
    for (;;) {
      const found = await tx.contact.findFirst({
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

  private async allocateCompanyUrlSlugTx(
    tx: Prisma.TransactionClient,
    nameSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyForUrl(nameSource);
    let candidate = base;
    let n = 0;
    for (;;) {
      const found = await tx.company.findFirst({
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

  private async allocateContactUrlSlug(
    nameSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyForUrl(nameSource);
    let candidate = base;
    let n = 0;
    for (;;) {
      const found = await this.prisma.contact.findFirst({
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

  private async resolveContactId(param: string): Promise<string> {
    const raw = param.trim();
    if (!raw) {
      throw new NotFoundException('Contacto no encontrado');
    }
    const byId = await this.prisma.contact.findUnique({
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
    const bySlug = await this.prisma.contact.findUnique({
      where: { urlSlug: slug },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;
    throw new NotFoundException('Contacto no encontrado');
  }

  private async createCompanyInTx(
    tx: Prisma.TransactionClient,
    dto: CreateCompanyDto,
  ): Promise<{ id: string; name: string }> {
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
    await this.crmConfig.assertEtapaAssignable(etapa);

    const dupName = await tx.company.findFirst({
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
      const dupRuc = await tx.company.findFirst({
        where: { ruc: rucTrim },
      });
      if (dupRuc) {
        throw new BadRequestException(
          'Ya existe una empresa registrada con el mismo RUC.',
        );
      }
    }

    const companyUrlSlug = await this.allocateCompanyUrlSlugTx(tx, name);
    const company = await tx.company.create({
      data: {
        urlSlug: companyUrlSlug,
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
    return { id: company.id, name: company.name };
  }

  async create(
    dto: CreateContactDto,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    const telefono = dto.telefono?.trim() || '-';
    const correo = dto.correo?.trim() ?? '';
    const fuente = dto.fuente?.trim() || 'base';
    const estimatedValue =
      dto.estimatedValue !== undefined &&
      dto.estimatedValue !== null &&
      Number.isFinite(dto.estimatedValue) &&
      dto.estimatedValue > 0
        ? dto.estimatedValue
        : 0;

    let assignedTo = dto.assignedTo?.trim() || null;
    if (scope && !scope.unrestricted) {
      assignedTo = scope.viewerUserId;
    } else if (assignedTo) {
      await this.assertUserExists(assignedTo);
    }

    const requestedCompanyId = dto.companyId?.trim();
    if (requestedCompanyId && dto.newCompany) {
      throw new BadRequestException(
        'No puedes enviar companyId y newCompany a la vez',
      );
    }

    if (requestedCompanyId) {
      const comp = await this.prisma.company.findFirst({
        where: mergeCompanyScope({ id: requestedCompanyId }, scope),
      });
      if (!comp) {
        throw new BadRequestException('La empresa indicada no existe');
      }
    }

    let newCompanyPayload = dto.newCompany;
    if (dto.newCompany && scope && !scope.unrestricted) {
      newCompanyPayload = {
        ...dto.newCompany,
        assignedTo: scope.viewerUserId,
      };
    } else if (dto.newCompany) {
      const ncAssigned = dto.newCompany.assignedTo?.trim();
      if (ncAssigned) {
        await this.assertUserExists(ncAssigned);
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

    await this.crmConfig.assertEtapaAssignable(etapa);

    const { contact: row, effectiveCompanyId } = await this.prisma.$transaction(
      async (tx) => {
        let effectiveCompanyId: string | null = requestedCompanyId || null;
        if (newCompanyPayload) {
          const comp = await this.createCompanyInTx(tx, newCompanyPayload);
          effectiveCompanyId = comp.id;
        }

        const contactUrlSlug = await this.allocateContactUrlSlugTx(tx, name);
        const created = await tx.contact.create({
          data: {
            urlSlug: contactUrlSlug,
            name,
            telefono,
            correo,
            fuente,
            cargo: dto.cargo?.trim() || null,
            etapa,
            assignedTo,
            estimatedValue,
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

        if (effectiveCompanyId) {
          await tx.companyContact.create({
            data: {
              contactId: created.id,
              companyId: effectiveCompanyId,
              isPrimary: true,
            },
          });
        }

        return { contact: created, effectiveCompanyId };
      },
    );

    if (effectiveCompanyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: effectiveCompanyId },
        select: { name: true },
      });
      const expectedClose = new Date();
      expectedClose.setDate(expectedClose.getDate() + 30);
      await this.entitySync.ensureOpportunityForContactCompany(
        row.id,
        effectiveCompanyId,
        {
          title: company?.name?.trim() || 'Oportunidad',
          amount: dto.estimatedValue!,
          etapa,
          assignedTo,
          expectedCloseDate: expectedClose,
        },
      );
      await this.entitySync.propagateFromContact(effectiveCompanyId, row.id);
    }

    await this.activityLogs.record(actor ?? null, {
      action: 'crear',
      module: 'contactos',
      entityType: 'Contacto',
      entityId: row.id,
      entityName: row.name,
      description: `Contacto creado: ${row.name}`,
    });

    if (assignedTo) {
      let companyName: string | null = null;
      if (effectiveCompanyId) {
        const co = await this.prisma.company.findUnique({
          where: { id: effectiveCompanyId },
          select: { name: true },
        });
        companyName = co?.name ?? null;
      }
      await this.notifications.notifyNewContact({
        userId: assignedTo,
        contactId: row.id,
        contactName: row.name,
        companyName,
      });
    }

    return this.findOne(row.id, scope);
  }

  private contactListWhere(
    opts?: {
      search?: string;
      etapa?: string;
      fuente?: string;
      assignedTo?: string;
    },
    scope?: CrmDataScope,
  ): Prisma.ContactWhereInput {
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
    if (scope && !scope.unrestricted) {
      where.assignedTo = scope.viewerUserId;
    } else if (opts?.assignedTo?.trim()) {
      where.assignedTo = opts.assignedTo.trim();
    }
    return where;
  }

  /**
   * Conteos por etapa para pestañas (mismos filtros que GET /contacts salvo etapa).
   */
  async etapaTabCounts(
    opts?: {
      search?: string;
      fuente?: string;
      assignedTo?: string;
    },
    scope?: CrmDataScope,
  ): Promise<{ counts: Record<string, number> }> {
    const results = await Promise.all(
      CONTACT_TAB_ETAPAS.map((slug) =>
        this.prisma.contact.count({
          where: this.contactListWhere({ ...opts, etapa: slug }, scope),
        }),
      ),
    );
    const counts: Record<string, number> = {};
    CONTACT_TAB_ETAPAS.forEach((slug, i) => {
      counts[slug] = results[i] ?? 0;
    });
    return { counts };
  }

  async findAll(
    opts?: {
      page?: number;
      limit?: number;
      search?: string;
      etapa?: string;
      fuente?: string;
      assignedTo?: string;
    },
    scope?: CrmDataScope,
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(5000, Math.max(1, opts?.limit ?? 25));
    const skip = (page - 1) * limit;

    const where = this.contactListWhere(opts, scope);

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

  async findOne(idOrSlug: string, scope?: CrmDataScope) {
    const id = await this.resolveContactId(idOrSlug);
    const row = await this.prisma.contact.findUnique({
      where: { id },
      include: contactIncludeDetail,
    });
    if (!row) {
      throw new NotFoundException('Contacto no encontrado');
    }
    if (
      scope &&
      !scope.unrestricted &&
      row.assignedTo !== scope.viewerUserId
    ) {
      throw new NotFoundException('Contacto no encontrado');
    }
    return row;
  }

  async update(
    idOrSlug: string,
    dto: UpdateContactDto,
    actor: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const id = await this.resolveContactId(idOrSlug);
    const snapshot = await this.prisma.contact.findUnique({
      where: { id },
      select: {
        name: true,
        telefono: true,
        correo: true,
        fuente: true,
        cargo: true,
        etapa: true,
        assignedTo: true,
        estimatedValue: true,
        docType: true,
        docNumber: true,
        departamento: true,
        provincia: true,
        distrito: true,
        direccion: true,
        clienteRecuperado: true,
        etapaHistory: true,
      },
    });
    if (!snapshot) {
      throw new NotFoundException('Contacto no encontrado');
    }
    if (
      scope &&
      !scope.unrestricted &&
      snapshot.assignedTo !== scope.viewerUserId
    ) {
      throw new NotFoundException('Contacto no encontrado');
    }
    if (scope && !scope.unrestricted && dto.assignedTo !== undefined) {
      const next = dto.assignedTo?.trim() || null;
      if (next !== scope.viewerUserId) {
        throw new BadRequestException(
          'No tienes permiso para reasignar este contacto',
        );
      }
    }

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre no puede estar vacío');
      }
      data.name = name;
      data.urlSlug = await this.allocateContactUrlSlug(name, id);
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
      await this.crmConfig.assertEtapaAssignable(etapa);
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

    const etapaChanged =
      dto.etapa !== undefined && dto.etapa.trim() !== snapshot.etapa;
    const action = etapaChanged ? 'cambiar_etapa' : 'actualizar';
    const description = etapaChanged
      ? `Etapa del contacto: ${snapshot.etapa} → ${dto.etapa!.trim()}`
      : 'Datos del contacto actualizados.';

    const auditPatch: Record<string, unknown> = { ...data };
    delete auditPatch.urlSlug;
    const before = { ...snapshot } as Record<string, unknown>;
    const diffEntries = buildChangeEntries(
      before,
      auditPatch,
      CONTACT_FIELD_LABELS,
      ['urlSlug'],
    );

    const displayName =
      typeof data.name === 'string' ? data.name : snapshot.name;

    await this.auditDetail.record(actor, {
      action,
      module: 'contactos',
      entityType: 'Contacto',
      entityId: id,
      entityName: displayName,
      entries: diffEntries,
    });

    await this.activityLogs.record(actor, {
      action,
      module: 'contactos',
      entityType: 'Contacto',
      entityId: id,
      entityName: displayName,
      description,
    });

    return this.findOne(id, scope);
  }

  async remove(
    idOrSlug: string,
    actor: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const id = await this.resolveContactId(idOrSlug);
    const row = await this.prisma.contact.findUnique({
      where: { id },
      select: { name: true, assignedTo: true },
    });
    if (!row) {
      throw new NotFoundException('Contacto no encontrado');
    }
    if (
      scope &&
      !scope.unrestricted &&
      row.assignedTo !== scope.viewerUserId
    ) {
      throw new NotFoundException('Contacto no encontrado');
    }
    const deleted = await this.prisma.contact.delete({
      where: { id },
    });
    await this.auditDetail.record(actor, {
      action: 'eliminar',
      module: 'contactos',
      entityType: 'Contacto',
      entityId: id,
      entityName: row.name,
      entries: [
        {
          fieldKey: '_registro',
          fieldLabel: 'Registro',
          oldValue: row.name,
          newValue: '(eliminado)',
        },
      ],
    });
    await this.activityLogs.record(actor, {
      action: 'eliminar',
      module: 'contactos',
      entityType: 'Contacto',
      entityId: id,
      entityName: row.name,
      description: `Contacto eliminado: ${row.name}`,
      isCritical: true,
    });
    return deleted;
  }

  async addCompany(
    contactIdOrSlug: string,
    companyId: string,
    isPrimary = false,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const contactId = await this.resolveContactId(contactIdOrSlug);
    await this.findOne(contactId, scope);
    const company = await this.prisma.company.findFirst({
      where: mergeCompanyScope({ id: companyId }, scope),
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
    if (actor) {
      const contactRow = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { name: true },
      });
      await this.activityLogs.record(actor, {
        action: 'actualizar',
        module: 'contactos',
        entityType: 'Contacto',
        entityId: contactId,
        entityName: contactRow?.name,
        description: `Empresa vinculada al contacto: ${company.name}`,
      });
    }
    return this.findOne(contactId, scope);
  }

  async removeCompany(
    contactIdOrSlug: string,
    companyId: string,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const contactId = await this.resolveContactId(contactIdOrSlug);
    await this.findOne(contactId, scope);
    const deleted = await this.prisma.companyContact.deleteMany({
      where: { contactId, companyId },
    });
    if (deleted.count === 0) {
      throw new BadRequestException('El vínculo no existe');
    }
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (actor) {
      const contactRow = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { name: true },
      });
      await this.activityLogs.record(actor, {
        action: 'actualizar',
        module: 'contactos',
        entityType: 'Contacto',
        entityId: contactId,
        entityName: contactRow?.name,
        description: `Se quitó la vinculación con la empresa ${
          company?.name ?? companyId
        }`,
      });
    }
    return this.findOne(contactId, scope);
  }

  async addLinkedContact(
    contactIdOrSlug: string,
    linkedContactId: string,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const contactId = await this.resolveContactId(contactIdOrSlug);
    if (contactId === linkedContactId) {
      throw new BadRequestException('Un contacto no puede vincularse consigo mismo');
    }
    await this.findOne(contactId, scope);
    const linked = await this.prisma.contact.findUnique({
      where: { id: linkedContactId },
    });
    if (!linked) {
      throw new BadRequestException('El contacto a vincular no existe');
    }
    if (
      scope &&
      !scope.unrestricted &&
      linked.assignedTo !== scope.viewerUserId
    ) {
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
    if (actor) {
      const contactRow = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { name: true },
      });
      await this.activityLogs.record(actor, {
        action: 'actualizar',
        module: 'contactos',
        entityType: 'Contacto',
        entityId: contactId,
        entityName: contactRow?.name,
        description: `Contacto vinculado: ${linked.name}`,
      });
    }
    return this.findOne(contactId, scope);
  }

  async removeLinkedContact(
    contactIdOrSlug: string,
    linkedId: string,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const contactId = await this.resolveContactId(contactIdOrSlug);
    await this.findOne(contactId, scope);
    const deleted = await this.prisma.contactContact.deleteMany({
      where: { contactId, linkedId },
    });
    if (deleted.count === 0) {
      throw new BadRequestException('El vínculo no existe');
    }
    const other = await this.prisma.contact.findUnique({
      where: { id: linkedId },
      select: { name: true },
    });
    if (actor) {
      const contactRow = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { name: true },
      });
      await this.activityLogs.record(actor, {
        action: 'actualizar',
        module: 'contactos',
        entityType: 'Contacto',
        entityId: contactId,
        entityName: contactRow?.name,
        description: `Se eliminó el vínculo con el contacto ${
          other?.name ?? linkedId
        }`,
      });
    }
    return this.findOne(contactId, scope);
  }
}
