import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import type { INestApplicationContext } from '@nestjs/common';

/**
 * CORS alineado con HTTP para clientes Socket.IO (mismo origen que la API).
 */
export class SocketIoAdapter extends IoAdapter {
  constructor(app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: true,
        credentials: true,
      },
    } as ServerOptions);
  }
}
