import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

export type CrmNotificationSocketPayload = {
  kind: string;
  ts: number;
};

function roomForUser(userId: string): string {
  return `crm-notif:${userId}`;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection {
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
      void client.join(roomForUser(user.id));
    } catch {
      client.disconnect(true);
    }
  }

  emitToUser(userId: string, kind: string) {
    if (!this.server || !userId) return;
    const payload: CrmNotificationSocketPayload = {
      kind,
      ts: Date.now(),
    };
    this.server.to(roomForUser(userId)).emit('crm_notification', payload);
  }

  emitToUsers(userIds: string[], kind: string) {
    const unique = [...new Set(userIds.filter(Boolean))];
    for (const id of unique) {
      this.emitToUser(id, kind);
    }
  }
}
