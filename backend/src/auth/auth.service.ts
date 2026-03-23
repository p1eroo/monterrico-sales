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

    const existing = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existing) {
      throw new ConflictException('Ese nombre de usuario ya existe');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const role = (dto.role?.trim() || 'asesor').toLowerCase();

    const user = await this.prisma.user.create({
      data: {
        username,
        name: dto.name.trim(),
        passwordHash,
        role,
        status: 'activo',
      },
    });

    return this.buildAuthResponse(user);
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.passwordHash) {
      throw new BadRequestException('No se puede actualizar la contraseña');
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { ok: true, message: 'Contraseña actualizada' };
  }

  async login(usernameRaw: string, password: string) {
    const username = this.normalizeUsername(usernameRaw);
    if (!username || !password) {
      throw new UnauthorizedException('Usuario y contraseña requeridos');
    }

    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.status !== 'activo') {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Esta cuenta no tiene contraseña configurada. Usa registro o restablecimiento.',
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActivity: new Date() },
    });

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: {
    id: string;
    username: string;
    name: string;
    role: string;
  }) {
    const payload = {
      sub: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
  }
}
