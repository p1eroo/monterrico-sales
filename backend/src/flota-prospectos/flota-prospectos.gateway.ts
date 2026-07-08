import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

export type FlotaProspectoSocketEventType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'operador_assigned';

export type FlotaProspectoSocketPayload = {
  type: FlotaProspectoSocketEventType;
  prospectoId: string;
  ts: number;
};

@WebSocketGateway({
  namespace: '/flota-prospectos',
  cors: { origin: true, credentials: true },
})
export class FlotaProspectosGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const raw =
      (client.handshake.auth as { token?: string })?.token ??
      (typeof client.handshake.headers.authorization === 'string'
        ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
        : undefined);
    if (!raw?.trim()) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(raw.trim());
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true, sessionVersion: true },
      });
      if (
        !user ||
        user.status !== 'activo' ||
        payload.sessionVersion !== user.sessionVersion
      ) {
        client.disconnect(true);
        return;
      }
      (client.data as { userId?: string }).userId = user.id;
    } catch {
      client.disconnect(true);
    }
  }

  emitChange(type: FlotaProspectoSocketEventType, prospectoId: string) {
    if (!this.server) return;
    const payload: FlotaProspectoSocketPayload = {
      type,
      prospectoId,
      ts: Date.now(),
    };
    this.server.emit('flota_prospecto', payload);
  }
}
