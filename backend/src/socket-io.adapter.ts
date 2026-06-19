import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import type { INestApplicationContext } from '@nestjs/common';

export class SocketIoAdapter extends IoAdapter {
  static ioServer: Server | null = null;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: true,
        credentials: true,
      },
    } as ServerOptions);
    SocketIoAdapter.ioServer = server;
    return server;
  }
}
