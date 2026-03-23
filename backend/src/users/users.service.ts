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

/** Obtiene username desde Account (provider=credentials) */
function getUsernameFromAccounts(accounts?: { provider: string; providerId: string }[]): string {
  const list = accounts ?? [];
  const cred = list.find((a) => a.provider === 'credentials');
  return cred?.providerId ?? '';
}

/** Formato API: role (slug), roleId (Role.id), username desde Account */
function toApiUser(
  row: {
    id: string;
    name: string;
    role: { id: string; slug: string };
    status: string;
    lastActivity?: Date | null;
    joinedAt?: Date | null;
    accounts?: { provider: string; providerId: string }[];
  },
) {
  return {
    id: row.id,
    username: getUsernameFromAccounts(row.accounts),
    name: row.name,
    roleId: row.role.id,
    role: row.role.slug,
    status: row.status,
    lastActivity: row.lastActivity,
    joinedAt: row.joinedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.user.findMany({
      include: {
        role: { select: { id: true, slug: true } },
        accounts: { select: { provider: true, providerId: true } },
      },
    });
    return rows.map(toApiUser);
  }

  async findOne(id: string) {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: { select: { id: true, slug: true } },
        accounts: { select: { provider: true, providerId: true } },
      },
    });
    return row ? toApiUser(row) : null;
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

    const roleRow = await this.prisma.role.findUnique({
      where: { id: dto.roleId.trim() },
    });
    if (!roleRow) {
      throw new BadRequestException('Rol no encontrado');
    }

    const existingAccount = await this.prisma.account.findUnique({
      where: {
        provider_providerId: { provider: 'credentials', providerId: username },
      },
    });
    if (existingAccount) {
      throw new ConflictException('Ese nombre de usuario ya existe');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const status =
      dto.status === false ? 'inactivo' : 'activo';

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        roleId: roleRow.id,
        status,
        accounts: {
          create: {
            provider: 'credentials',
            providerId: username,
            passwordHash,
          },
        },
      },
      include: { role: true, accounts: true },
    });

    return toApiUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const data: {
      name?: string;
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
      const roleRow = await this.prisma.role.findUnique({
        where: { id: dto.roleId.trim() },
      });
      if (!roleRow) {
        throw new BadRequestException('Rol no encontrado');
      }
      data.roleId = roleRow.id;
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
      include: { role: true, accounts: true },
    });

    return toApiUser(user);
  }
}
