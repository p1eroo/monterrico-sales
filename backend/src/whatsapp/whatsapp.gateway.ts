import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

export type WhatsappSocketPayload =
  | { type: 'message'; contactId: string; item: Record<string, unknown> }
  | {
      type: 'status';
      contactId: string;
      id: string;
      waOutboundStatus: string;
    };

@WebSocketGateway({
  namespace: '/whatsapp',
  cors: { origin: true, credentials: true },
})
export class WhatsappGateway implements OnGatewayConnection {
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

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { contactId?: string },
  ) {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) {
      return { ok: false, error: 'unauthorized' };
    }
    const contactId = body?.contactId?.trim();
    if (!contactId) {
      return { ok: false, error: 'contactId' };
    }
    const room = roomForContact(contactId);
    void client.join(room);
    return { ok: true, room };
  }

  emitToContact(contactId: string, payload: WhatsappSocketPayload) {
    if (!this.server) return;
    this.server.to(roomForContact(contactId)).emit('whatsapp', payload);
  }
}

export function roomForContact(contactId: string): string {
  return `whatsapp:contact:${contactId}`;
}
