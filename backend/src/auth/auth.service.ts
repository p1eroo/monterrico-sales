import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS } from './auth.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  async register(dto: {
    username: string;
    password: string;
    name: string;
    role?: string;
  }) {
    const username = this.normalizeUsername(dto.username);
    if (!username || !dto.password || dto.password.length < 6) {
      throw new BadRequestException(
        'Usuario y contraseña requeridos (mínimo 6 caracteres)',
      );
    }
    if (!dto.name?.trim()) {
      throw new BadRequestException('El nombre es requerido');
    }

    const userCount = await this.prisma.user.count();
    const allowOpen =
      process.env.ALLOW_OPEN_REGISTRATION === 'true' || userCount === 0;
    if (!allowOpen) {
      throw new ForbiddenException(
        'El registro público está desactivado. Contacta a un administrador o define ALLOW_OPEN_REGISTRATION=true en desarrollo.',
      );
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
    const roleSlug = (dto.role?.trim() || 'admin').toLowerCase();
    let roleToUse = await this.prisma.role.findFirst({
      where: { slug: roleSlug },
    });
    if (!roleToUse) {
      roleToUse = await this.prisma.role.findFirst({
        where: { slug: 'admin' },
      });
    }
    if (!roleToUse) {
      throw new BadRequestException('No existe el rol admin en la base de datos');
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        roleId: roleToUse.id,
        status: 'activo',
        accounts: {
          create: {
            provider: 'credentials',
            providerId: username,
            passwordHash,
          },
        },
      },
      include: { role: true },
    });

    return this.buildAuthResponse(user, username);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Contraseña actual y nueva son requeridas');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException(
        'La nueva contraseña debe tener al menos 6 caracteres',
      );
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta a la actual',
      );
    }

    const credAccount = await this.prisma.account.findFirst({
      where: {
        userId,
        provider: 'credentials',
        passwordHash: { not: null },
      },
    });
    if (!credAccount?.passwordHash) {
      throw new BadRequestException('No se puede actualizar la contraseña');
    }

    const ok = await bcrypt.compare(currentPassword, credAccount.passwordHash);
    if (!ok) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.account.update({
      where: { id: credAccount.id },
      data: { passwordHash },
    });

    return { ok: true, message: 'Contraseña actualizada' };
  }

  async login(usernameRaw: string, password: string) {
    const username = this.normalizeUsername(usernameRaw);
    if (!username || !password) {
      throw new UnauthorizedException('Usuario y contraseña requeridos');
    }

    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerId: { provider: 'credentials', providerId: username },
      },
      include: { user: { include: { role: true } } },
    });

    if (!account?.user || account.user.status !== 'activo') {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!account.passwordHash) {
      throw new UnauthorizedException(
        'Esta cuenta no tiene contraseña configurada. Usa registro o restablecimiento.',
      );
    }

    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.user.update({
      where: { id: account.user.id },
      data: { lastActivity: new Date() },
    });

    return this.buildAuthResponse(account.user, account.providerId);
  }

  private buildAuthResponse(
    user: { id: string; name: string; role: { slug: string } },
    username: string,
  ) {
    const roleSlug = user.role.slug;
    const payload = {
      sub: user.id,
      username,
      name: user.name,
      role: roleSlug,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username,
        name: user.name,
        role: roleSlug,
      },
    };
  }
}
