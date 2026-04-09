import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS } from './auth.constants';
import { MediaUploadService } from '../media/media-upload.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mediaUpload: MediaUploadService,
    private readonly activityLogs: ActivityLogsService,
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

    return await this.buildAuthResponse(user, username);
  }

  private async getPermissionsForRoleId(roleId: string): Promise<string[]> {
    const rows = await this.prisma.authority.findMany({
      where: { roleId },
      select: { permission: true },
      orderBy: { permission: 'asc' },
    });
    return rows.map((r) => r.permission);
  }

  private async getCredentialsUsername(userId: string): Promise<string> {
    const cred = await this.prisma.account.findFirst({
      where: { userId, provider: 'credentials' },
      select: { providerId: true },
    });
    return cred?.providerId ?? '';
  }

  private async formatMeResponse(
    user: {
      id: string;
      name: string;
      phone: string | null;
      avatar: string | null;
      roleId: string;
      joinedAt: Date;
      lastActivity: Date | null;
      role: { slug: string; name: string };
    },
    username: string,
  ) {
    const permissions = await this.getPermissionsForRoleId(user.roleId);
    return {
      id: user.id,
      username,
      name: user.name,
      phone: user.phone ?? '',
      avatar: user.avatar ?? '',
      role: user.role.slug,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions,
      joinedAt: user.joinedAt.toISOString(),
      lastActivity: user.lastActivity?.toISOString() ?? null,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (user.status !== 'activo') {
      throw new UnauthorizedException('Usuario inactivo');
    }
    const username = await this.getCredentialsUsername(userId);
    return this.formatMeResponse(user, username);
  }

  async updateProfile(
    userId: string,
    body: { name?: string; phone?: string },
  ) {
    const data: { name?: string; phone?: string | null } = {};
    if (body.name !== undefined) {
      const n = body.name.trim();
      if (n.length < 2) {
        throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
      }
      data.name = n;
    }
    if (body.phone !== undefined) {
      const p = body.phone.trim();
      data.phone = p === '' ? null : p;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Indica nombre o teléfono a actualizar');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { role: true },
    });
    const username = await this.getCredentialsUsername(userId);
    return this.formatMeResponse(user, username);
  }

  async updateAvatar(
    userId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string,
    authorizationHeader?: string,
  ) {
    if (!this.mediaUpload.isProxyUrlConfigured()) {
      throw new ServiceUnavailableException(
        'MEDIA_UPLOAD_URL no está configurado (proxy de medios).',
      );
    }
    const bucket = this.mediaUpload.avatarBucket();
    const url = await this.mediaUpload.uploadToBucket(
      bucket,
      buffer,
      originalName || 'avatar.jpg',
      mimeType || 'image/jpeg',
      { authorizationHeader },
    );
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: url },
      include: { role: true },
    });
    const username = await this.getCredentialsUsername(userId);
    return this.formatMeResponse(user, username);
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

    if (!account?.user) {
      await this.activityLogs.record(null, {
        action: 'login_fallido',
        module: 'sistema',
        entityType: 'Sistema',
        description: `Intento de inicio de sesión con usuario inexistente (${username})`,
        status: 'fallido',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (account.user.status !== 'activo') {
      await this.activityLogs.record(
        { userId: account.user.id, userName: account.user.name },
        {
          action: 'login_fallido',
          module: 'sistema',
          entityType: 'Usuario',
          entityId: account.user.id,
          entityName: account.user.name,
          description: 'Intento de inicio de sesión con usuario inactivo',
          status: 'fallido',
          isCritical: true,
        },
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!account.passwordHash) {
      await this.activityLogs.record(
        { userId: account.user.id, userName: account.user.name },
        {
          action: 'login_fallido',
          module: 'sistema',
          entityType: 'Usuario',
          entityId: account.user.id,
          entityName: account.user.name,
          description:
            'Intento de inicio de sesión sin contraseña configurada en la cuenta',
          status: 'fallido',
        },
      );
      throw new UnauthorizedException(
        'Esta cuenta no tiene contraseña configurada. Usa registro o restablecimiento.',
      );
    }

    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) {
      await this.activityLogs.record(
        { userId: account.user.id, userName: account.user.name },
        {
          action: 'login_fallido',
          module: 'sistema',
          entityType: 'Usuario',
          entityId: account.user.id,
          entityName: account.user.name,
          description: `Contraseña incorrecta al iniciar sesión (${username})`,
          status: 'fallido',
          isCritical: true,
        },
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.user.update({
      where: { id: account.user.id },
      data: { lastActivity: new Date() },
    });

    await this.activityLogs.record(
      { userId: account.user.id, userName: account.user.name },
      {
        action: 'login',
        module: 'sistema',
        entityType: 'Usuario',
        entityId: account.user.id,
        entityName: account.user.name,
        description: `Inicio de sesión correcto (${username})`,
        status: 'exito',
      },
    );

    return await this.buildAuthResponse(account.user, account.providerId);
  }

  private async buildAuthResponse(
    user: {
      id: string;
      name: string;
      phone: string | null;
      avatar: string | null;
      roleId: string;
      joinedAt: Date;
      lastActivity: Date | null;
      role: { slug: string; name: string };
    },
    username: string,
  ) {
    const roleSlug = user.role.slug;
    const permissions = await this.getPermissionsForRoleId(user.roleId);
    const payload = {
      sub: user.id,
      username,
      name: user.name,
      role: roleSlug,
      roleId: user.roleId,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username,
        name: user.name,
        phone: user.phone ?? '',
        avatar: user.avatar ?? '',
        role: roleSlug,
        roleId: user.roleId,
        roleName: user.role.name,
        joinedAt: user.joinedAt.toISOString(),
        lastActivity: user.lastActivity?.toISOString() ?? null,
        permissions,
      },
    };
  }
}
