// users.service.ts
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS } from '../auth/auth.constants';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** roleId del CRM (r1–r4) → campo `role` persistido (JWT / permisos). */
export function roleFromRoleId(roleId: string): string {
  if (roleId === 'r1') return 'admin';
  if (roleId === 'r2') return 'supervisor';
  if (roleId === 'r4') return 'solo_lectura';
  return 'asesor';
}

/** Si en BD falta roleId (datos antiguos), infiérelo desde `role`. */
export function inferRoleIdFromRole(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === 'admin') return 'r1';
  if (r === 'supervisor' || r === 'gerente') return 'r2';
  if (r === 'solo_lectura') return 'r4';
  return 'r3';
}

function withResolvedRoleId<T extends { role: string; roleId: string | null }>(
  row: T,
): T & { roleId: string } {
  return {
    ...row,
    roleId: row.roleId ?? inferRoleIdFromRole(row.role),
  };
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.user.findMany({
      omit: { passwordHash: true },
    });
    return rows.map((u) => withResolvedRoleId(u));
  }

  async findOne(id: string) {
    const row = await this.prisma.user.findUnique({
      where: { id },
      omit: { passwordHash: true },
    });
    return row ? withResolvedRoleId(row) : null;
  }

  async create(dto: CreateUserDto) {
    const username = normalizeUsername(dto.username);
    if (!username) {
      throw new BadRequestException('Usuario requerido');
    }
    if (!dto.name?.trim()) {
      throw new BadRequestException('El nombre es requerido');
    }
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException(
        'Contraseña requerida (mínimo 6 caracteres)',
      );
    }
    if (!dto.roleId?.trim()) {
      throw new BadRequestException('Rol requerido');
    }

    const existing = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existing) {
      throw new ConflictException('Ese nombre de usuario ya existe');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const role = roleFromRoleId(dto.roleId);
    const status =
      dto.status === false ? 'inactivo' : 'activo';

    const user = await this.prisma.user.create({
      data: {
        username,
        name: dto.name.trim(),
        passwordHash,
        role,
        roleId: dto.roleId,
        status,
      },
      omit: { passwordHash: true },
    });

    return withResolvedRoleId(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const data: {
      name?: string;
      role?: string;
      roleId?: string;
      status?: string;
    } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre no puede estar vacío');
      }
      data.name = name;
    }

    if (dto.roleId !== undefined) {
      if (!dto.roleId.trim()) {
        throw new BadRequestException('roleId inválido');
      }
      data.roleId = dto.roleId;
      data.role = roleFromRoleId(dto.roleId);
    }

    if (dto.status !== undefined) {
      data.status = dto.status === false ? 'inactivo' : 'activo';
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'Envía al menos uno: name, roleId o status',
      );
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      omit: { passwordHash: true },
    });

    return withResolvedRoleId(user);
  }
}
