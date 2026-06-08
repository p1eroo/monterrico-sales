import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.role.findMany({
      include: {
        authorities: { select: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.authorities.map((a) => a.permission),
      userCount: r._count.users,
    }));
  }

  async findOne(id: string) {
    const row = await this.prisma.role.findUnique({
      where: { id },
      include: {
        authorities: { select: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isSystem: row.isSystem,
      permissions: row.authorities.map((a) => a.permission),
      userCount: row._count.users,
    };
  }

  async create(dto: { name: string; slug?: string; description?: string; permissions?: string[] }) {
    const slug = (dto.slug ?? dto.name.toLowerCase().replace(/\s+/g, '_')).trim();
    if (!slug) {
      throw new BadRequestException('Nombre o slug requerido');
    }

    const existing = await this.prisma.role.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new BadRequestException(`Ya existe un rol con slug "${slug}"`);
    }

    const permissions = dto.permissions ?? [];
    const role = await this.prisma.role.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim(),
        isSystem: false,
        authorities: {
          create: permissions.map((p) => ({ permission: p })),
        },
      },
      include: { authorities: { select: { permission: true } } },
    });

    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.authorities.map((a) => a.permission),
    };
  }

  async update(id: string, dto: { name?: string; description?: string; permissions?: string[] }) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Rol no encontrado');
    }
    if (existing.isSystem && dto.permissions !== undefined) {
      throw new ForbiddenException('No se pueden modificar los permisos de roles del sistema');
    }

    const data: { name?: string; description?: string } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim();

    if (dto.permissions !== undefined && !existing.isSystem) {
      await this.prisma.authority.deleteMany({ where: { roleId: id } });
      if (dto.permissions.length > 0) {
        await this.prisma.authority.createMany({
          data: dto.permissions.map((permission) => ({ roleId: id, permission })),
        });
      }
    }

    const role = await this.prisma.role.update({
      where: { id },
      data,
      include: { authorities: { select: { permission: true } } },
    });

    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.authorities.map((a) => a.permission),
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Rol no encontrado');
    }
    if (existing.isSystem) {
      throw new ForbiddenException('No se puede eliminar un rol del sistema');
    }
    if (existing._count.users > 0) {
      throw new BadRequestException(
        `Hay ${existing._count.users} usuario(s) con este rol. Asígnales otro rol primero.`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
    return { ok: true };
  }
}
