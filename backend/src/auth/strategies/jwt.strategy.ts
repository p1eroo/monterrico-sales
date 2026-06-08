import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_SECRET } from '../auth.constants';
import { PrismaService } from '../../prisma/prisma.service';

export type JwtPayload = {
  sub: string;
  username: string;
  name: string;
  role: string;
  /** Presente en tokens emitidos tras esta versión; si falta, el token se considera obsoleto. */
  roleId?: string;
  sessionVersion?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        status: true,
        roleId: true,
        sessionVersion: true,
      },
    });
    if (!user || user.status !== 'activo') {
      throw new UnauthorizedException('Sesión inválida');
    }
    if (payload.sessionVersion !== user.sessionVersion) {
      throw new UnauthorizedException(
        'Tu sesión fue cerrada porque iniciaste sesión en otro navegador o dispositivo',
      );
    }
    return {
      userId: user.id,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      roleId: payload.roleId ?? user.roleId,
    };
  }
}
