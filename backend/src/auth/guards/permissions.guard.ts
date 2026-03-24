import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

type RequestUser = {
  userId: string;
  username: string;
  name: string;
  role: string;
  roleId?: string;
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;
    if (!user?.userId) {
      throw new ForbiddenException('No autorizado');
    }

    let roleId = user.roleId;
    if (!roleId) {
      const row = await this.prisma.user.findUnique({
        where: { id: user.userId },
        select: { roleId: true },
      });
      roleId = row?.roleId;
    }
    if (!roleId) {
      throw new ForbiddenException('Usuario sin rol asignado');
    }

    const authorities = await this.prisma.authority.findMany({
      where: { roleId },
      select: { permission: true },
    });
    const granted = new Set(authorities.map((a) => a.permission));

    for (const perm of required) {
      if (!granted.has(perm)) {
        throw new ForbiddenException(`Permiso denegado: ${perm}`);
      }
    }
    return true;
  }
}
