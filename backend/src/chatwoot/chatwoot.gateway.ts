import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/chatwoot',
  cors: { origin: true, credentials: true },
})
export class ChatwootGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('join')
  handleJoin(client: Socket, payload: { conversationId: number }) {
    client.join(`conv:${payload.conversationId}`);
  }

  @SubscribeMessage('leave')
  handleLeave(client: Socket, payload: { conversationId: number }) {
    client.leave(`conv:${payload.conversationId}`);
  }

  emitMessage(conversationId: number, event: string, data: unknown) {
    this.server.to(`conv:${conversationId}`).emit('chatwoot', { event, data });
    this.server.emit('chatwoot', { event, data, conversationId });
  }

  emitGlobal(event: string, data: unknown) {
    this.server.emit('chatwoot', { event, data });
  }
}
