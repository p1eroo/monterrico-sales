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
    }
  | {
      type: 'delete';
      contactId: string;
      messageId: string;
      forEveryone?: boolean;
    }
  | {
      type: 'prospecto_updated';
      contactId: string;
      name: string;
    }
  | {
      type: 'operador_assigned';
      contactId: string;
      operador: string;
    };

export type FlotaBulkProgressPayload = {
  type: 'flota-bulk-progress';
  jobId: string;
  total: number;
  sent: number;
  failed: number;
  currentName: string;
  currentIndex: number;
  nextDelay: number;
  finished: boolean;
  cancelled: boolean;
  paused: boolean;
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

  @SubscribeMessage('join-bulk')
  handleJoinBulk(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { jobId?: string },
  ) {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) {
      return { ok: false, error: 'unauthorized' };
    }
    const jobId = body?.jobId?.trim();
    if (!jobId) {
      return { ok: false, error: 'jobId' };
    }
    const room = roomForBulk(jobId);
    void client.join(room);
    return { ok: true, room };
  }

  emitToContact(contactId: string, payload: WhatsappSocketPayload) {
    if (!this.server) return;
    this.server.emit('whatsapp', payload);
  }

  emitFlotaBulkProgress(payload: FlotaBulkProgressPayload) {
    if (!this.server) return;
    this.server.to(roomForBulk(payload.jobId)).emit('flota-bulk-progress', payload);
  }
}

export function roomForContact(contactId: string): string {
  return `whatsapp:contact:${contactId}`;
}

export function roomForBulk(jobId: string): string {
  return `flota-bulk:${jobId}`;
}
