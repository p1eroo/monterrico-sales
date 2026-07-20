import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { slugifyForUrl, isLikelyPrismaCuid } from '../common/url-slug.util';
import type { CreateContactoClienteDto } from './dto/create-contacto-cliente.dto';
import type { UpdateContactoClienteDto } from './dto/update-contacto-cliente.dto';

type EmpresaRow = Prisma.ClienteEmpresaGetPayload<object>;

const contactInclude = {
  user: { select: { id: true, name: true } },
  empresas: {
    include: {
      clienteEmpresa: { select: { id: true, empresa: true, logoUrl: true } },
    },
  },
} satisfies Prisma.ContactoClienteInclude;

type ContactoRow = Prisma.ContactoClienteGetPayload<{
  include: typeof contactInclude;
}>;

@Injectable()
export class ClienteCarteraService {
  constructor(private readonly prisma: PrismaService) {}

  async findEmpresas(scope: CrmDataScope, username: string) {
    const where = this.buildEmpresaAsesorWhere(scope, username);
    const rows = await this.prisma.clienteEmpresa.findMany({
      where,
      orderBy: { fechaAlta: 'desc' },
    });
    const advisorMap = await this.buildAdvisorMap(rows);
    return rows.map((row) => this.mapEmpresaToApi(row, advisorMap));
  }

  async findEmpresaById(
    idOrSlug: string,
    scope: CrmDataScope,
    username: string,
  ) {
    const id = await this.resolveEmpresaId(idOrSlug, scope, username);
    const row = await this.prisma.clienteEmpresa.findUnique({
      where: { id },
      include: {
        contactLinks: {
          include: {
            contactoCliente: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { contactoCliente: { nombres: 'asc' } }],
        },
      },
    });
    if (!row) throw new NotFoundException('Empresa cliente no encontrada');
    this.assertEmpresaInScope(row, scope, username);

    const advisorMap = await this.buildAdvisorMap([row]);
    const base = this.mapEmpresaToApi(row, advisorMap);
    return {
      ...base,
      contactos: row.contactLinks.map((link) =>
        this.mapLinkedContacto(link.contactoCliente, link.isPrimary),
      ),
    };
  }

  async findContactos(scope: CrmDataScope) {
    const where = this.buildContactoAssignedWhere(scope);
    const rows = await this.prisma.contactoCliente.findMany({
      where,
      orderBy: { nombres: 'asc' },
      include: contactInclude,
    });
    return rows.map((row) => this.mapContactoToApi(row));
  }

  async findContactoById(id: string, scope: CrmDataScope) {
    const row = await this.prisma.contactoCliente.findUnique({
      where: { id },
      include: contactInclude,
    });
    if (!row) throw new NotFoundException('Contacto no encontrado');
    this.assertContactoInScope(row, scope);
    return this.mapContactoToApi(row);
  }

  async createContacto(
    dto: CreateContactoClienteDto,
    scope: CrmDataScope,
    viewerUserId: string,
    username: string,
  ) {
    const assignedTo = dto.assignedTo?.trim() || viewerUserId;
    if (!scope.unrestricted && assignedTo !== viewerUserId) {
      throw new ForbiddenException('No puedes asignar contactos a otro asesor');
    }

    const row = await this.prisma.contactoCliente.create({
      data: {
        nombres: dto.nombres.trim(),
        apellidos: dto.apellidos?.trim() || null,
        telefono: dto.telefono?.trim() || null,
        email: dto.email?.trim() || null,
        cargo: dto.cargo?.trim() || null,
        etapa: dto.etapa?.trim() || null,
        source: dto.source?.trim() || null,
        clienteRecuperado: dto.clienteRecuperado?.trim() || null,
        departamento: dto.departamento?.trim() || null,
        provincia: dto.provincia?.trim() || null,
        distrito: dto.distrito?.trim() || null,
        direccion: dto.direccion?.trim() || null,
        assignedTo,
      },
      include: contactInclude,
    });

    const empresaId = dto.clienteEmpresaId?.trim();
    if (empresaId) {
      await this.linkContactoToEmpresa(
        empresaId,
        row.id,
        scope,
        username,
        dto.isPrimary ?? true,
      );
      const refreshed = await this.prisma.contactoCliente.findUnique({
        where: { id: row.id },
        include: contactInclude,
      });
      if (refreshed) return this.mapContactoToApi(refreshed);
    }

    return this.mapContactoToApi(row);
  }

  async updateContacto(
    id: string,
    dto: UpdateContactoClienteDto,
    scope: CrmDataScope,
    viewerUserId: string,
  ) {
    const existing = await this.prisma.contactoCliente.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Contacto no encontrado');
    this.assertContactoInScope(existing, scope);

    if (
      dto.assignedTo !== undefined &&
      !scope.unrestricted &&
      dto.assignedTo !== viewerUserId
    ) {
      throw new ForbiddenException('No puedes asignar contactos a otro asesor');
    }

    const row = await this.prisma.contactoCliente.update({
      where: { id },
      data: {
        ...(dto.nombres !== undefined && { nombres: dto.nombres.trim() }),
        ...(dto.apellidos !== undefined && {
          apellidos: dto.apellidos?.trim() || null,
        }),
        ...(dto.telefono !== undefined && {
          telefono: dto.telefono?.trim() || null,
        }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
        ...(dto.cargo !== undefined && { cargo: dto.cargo?.trim() || null }),
        ...(dto.etapa !== undefined && { etapa: dto.etapa?.trim() || null }),
        ...(dto.source !== undefined && { source: dto.source?.trim() || null }),
        ...(dto.clienteRecuperado !== undefined && {
          clienteRecuperado: dto.clienteRecuperado?.trim() || null,
        }),
        ...(dto.departamento !== undefined && {
          departamento: dto.departamento?.trim() || null,
        }),
        ...(dto.provincia !== undefined && {
          provincia: dto.provincia?.trim() || null,
        }),
        ...(dto.distrito !== undefined && { distrito: dto.distrito?.trim() || null }),
        ...(dto.direccion !== undefined && {
          direccion: dto.direccion?.trim() || null,
        }),
        ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
      },
      include: contactInclude,
    });
    return this.mapContactoToApi(row);
  }

  async deleteContacto(id: string, scope: CrmDataScope) {
    const existing = await this.prisma.contactoCliente.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Contacto no encontrado');
    this.assertContactoInScope(existing, scope);
    await this.prisma.contactoCliente.delete({ where: { id } });
    return { ok: true };
  }

  async linkContactoToEmpresa(
    empresaId: string,
    contactoClienteId: string,
    scope: CrmDataScope,
    username: string,
    isPrimary = false,
  ) {
    const empresa = await this.prisma.clienteEmpresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa) throw new NotFoundException('Empresa cliente no encontrada');
    this.assertEmpresaInScope(empresa, scope, username);

    const contacto = await this.prisma.contactoCliente.findUnique({
      where: { id: contactoClienteId },
    });
    if (!contacto) throw new NotFoundException('Contacto no encontrado');
    this.assertContactoInScope(contacto, scope);

    if (isPrimary) {
      await this.prisma.clienteEmpresaContacto.updateMany({
        where: { clienteEmpresaId: empresaId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    await this.prisma.clienteEmpresaContacto.upsert({
      where: {
        clienteEmpresaId_contactoClienteId: {
          clienteEmpresaId: empresaId,
          contactoClienteId,
        },
      },
      create: {
        clienteEmpresaId: empresaId,
        contactoClienteId,
        isPrimary,
      },
      update: { isPrimary },
    });

    return this.findEmpresaById(empresaId, scope, username);
  }

  async unlinkContactoFromEmpresa(
    empresaId: string,
    contactoClienteId: string,
    scope: CrmDataScope,
    username: string,
  ) {
    const empresa = await this.prisma.clienteEmpresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa) throw new NotFoundException('Empresa cliente no encontrada');
    this.assertEmpresaInScope(empresa, scope, username);

    await this.prisma.clienteEmpresaContacto.deleteMany({
      where: { clienteEmpresaId: empresaId, contactoClienteId },
    });

    return this.findEmpresaById(empresaId, scope, username);
  }

  private async resolveEmpresaId(
    idOrSlug: string,
    scope: CrmDataScope,
    username: string,
  ): Promise<string> {
    const raw = idOrSlug.trim();
    if (!raw) {
      throw new NotFoundException('Empresa cliente no encontrada');
    }

    if (!isLikelyPrismaCuid(raw)) {
      let slug = raw;
      try {
        slug = decodeURIComponent(raw);
      } catch {
        /* usar raw */
      }
      const normalized = slugifyForUrl(slug);
      const rows = await this.prisma.clienteEmpresa.findMany({
        where: this.buildEmpresaAsesorWhere(scope, username),
        select: { id: true, empresa: true },
      });
      const match = rows.find((row) => slugifyForUrl(row.empresa) === normalized);
      if (match) return match.id;
      throw new NotFoundException('Empresa cliente no encontrada');
    }

    const row = await this.prisma.clienteEmpresa.findUnique({
      where: { id: raw },
      select: { id: true, agenteSync: true },
    });
    if (!row) {
      throw new NotFoundException('Empresa cliente no encontrada');
    }
    this.assertEmpresaInScope(row, scope, username);
    return row.id;
  }

  private buildEmpresaAsesorWhere(
    scope: CrmDataScope,
    username: string,
  ): Prisma.ClienteEmpresaWhereInput {
    if (scope.unrestricted) return {};
    const agente = username.trim().toLowerCase();
    if (!agente) return { id: '__none__' };
    return { agenteSync: agente };
  }

  private buildContactoAssignedWhere(
    scope: CrmDataScope,
  ): Prisma.ContactoClienteWhereInput {
    if (scope.unrestricted) return {};
    return { assignedTo: scope.viewerUserId };
  }

  private assertEmpresaInScope(
    row: { agenteSync: string },
    scope: CrmDataScope,
    username: string,
  ) {
    if (scope.unrestricted) return;
    const agente = username.trim().toLowerCase();
    if (row.agenteSync !== agente) {
      throw new ForbiddenException('No tienes acceso a esta empresa cliente');
    }
  }

  private assertContactoInScope(
    row: { assignedTo: string | null },
    scope: CrmDataScope,
  ) {
    if (scope.unrestricted) return;
    if (row.assignedTo !== scope.viewerUserId) {
      throw new ForbiddenException('No tienes acceso a este contacto');
    }
  }

  private async buildAdvisorMap(rows: EmpresaRow[]) {
    return this.buildAdvisorMapFromUsernames(rows.map((r) => r.asesor));
  }

  private async buildAdvisorMapFromUsernames(usernames: string[]) {
    const unique = [
      ...new Set(usernames.map((u) => u.trim().toLowerCase()).filter(Boolean)),
    ];
    if (unique.length === 0) return new Map<string, { id: string; name: string }>();

    const accounts = await this.prisma.account.findMany({
      where: {
        provider: 'credentials',
        providerId: { in: unique },
      },
      select: {
        providerId: true,
        user: { select: { id: true, name: true } },
      },
    });

    const map = new Map<string, { id: string; name: string }>();
    for (const acc of accounts) {
      map.set(acc.providerId.toLowerCase(), {
        id: acc.user.id,
        name: acc.user.name,
      });
    }
    return map;
  }

  private mapEmpresaToApi(
    row: EmpresaRow,
    advisorMap: Map<string, { id: string; name: string }>,
  ) {
    const advisor = advisorMap.get(row.asesor.toLowerCase());
    const advisorUserId = advisor?.id ?? row.asesor;
    return {
      id: row.id,
      externalId: row.externalId,
      empresa: row.empresa,
      ruc: row.ruc ?? undefined,
      telefono: row.telefono ?? undefined,
      email: row.email ?? undefined,
      asesor: row.asesor,
      agenteSync: row.agenteSync,
      assignedTo: advisorUserId,
      assignedToName: advisor?.name ?? (row.asesor || 'Sin asesor'),
      fechaAlta: row.fechaAlta.toISOString().slice(0, 10),
      ingresos: row.ingresos,
      ingresosAnual: row.ingresosAnual,
      mesActual: row.mesActual ?? undefined,
      logoUrl: row.logoUrl ?? undefined,
      status: row.status,
      contactoNombre: row.contactoNombre ?? undefined,
      servicio: row.servicio ?? undefined,
      mes1: row.mes1 ?? undefined,
      monto1: row.monto1 ?? undefined,
      mes2: row.mes2 ?? undefined,
      monto2: row.monto2 ?? undefined,
      mes3: row.mes3 ?? undefined,
      monto3: row.monto3 ?? undefined,
      mes4: row.mes4 ?? undefined,
      monto4: row.monto4 ?? undefined,
      mes5: row.mes5 ?? undefined,
      monto5: row.monto5 ?? undefined,
    };
  }

  private mapLinkedContacto(
    row: Prisma.ContactoClienteGetPayload<{
      include: { user: { select: { id: true; name: true } } };
    }>,
    isPrimary: boolean,
  ) {
    const nombre = [row.nombres, row.apellidos].filter(Boolean).join(' ').trim();
    return {
      id: row.id,
      nombre: nombre || '—',
      nombres: row.nombres,
      apellidos: row.apellidos ?? undefined,
      telefono: row.telefono ?? undefined,
      email: row.email ?? undefined,
      cargo: row.cargo ?? undefined,
      assignedTo: row.assignedTo ?? undefined,
      assignedToName: row.user?.name ?? 'Sin asesor',
      isPrimary,
    };
  }

  private mapContactoToApi(row: ContactoRow) {
    const nombre = [row.nombres, row.apellidos].filter(Boolean).join(' ').trim();
    return {
      id: row.id,
      nombre: nombre || '—',
      nombres: row.nombres,
      apellidos: row.apellidos ?? undefined,
      telefono: row.telefono ?? undefined,
      email: row.email ?? undefined,
      cargo: row.cargo ?? undefined,
      etapa: row.etapa ?? undefined,
      source: row.source ?? undefined,
      clienteRecuperado: row.clienteRecuperado ?? undefined,
      departamento: row.departamento ?? undefined,
      provincia: row.provincia ?? undefined,
      distrito: row.distrito ?? undefined,
      direccion: row.direccion ?? undefined,
      assignedTo: row.assignedTo ?? 'unassigned',
      assignedToName: row.user?.name ?? 'Sin asesor',
      createdAt: row.createdAt.toISOString(),
      lastInteractionAt: row.updatedAt.toISOString(),
      empresas: row.empresas.map((link) => ({
        id: link.clienteEmpresa.id,
        empresa: link.clienteEmpresa.empresa,
        logoUrl: link.clienteEmpresa.logoUrl ?? undefined,
        isPrimary: link.isPrimary,
      })),
    };
  }
}
