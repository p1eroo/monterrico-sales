import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_SECRET } from '../auth.constants';

export type JwtPayload = {
  sub: string;
  username: string;
  name: string;
  role: string;
  /** Presente en tokens emitidos tras esta versión; si falta, el guard resuelve por userId. */
  roleId?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      roleId: payload.roleId,
    };
  }
}
