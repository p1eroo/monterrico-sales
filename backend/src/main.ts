import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { SocketIoAdapter } from './socket-io.adapter';
import { ChatwootEventService } from './chatwoot/chatwoot-event.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const bodyLimit = process.env.HTTP_BODY_LIMIT?.trim() || '20mb';

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);

  // Socket.IO para Chatwoot — usar el server que ya creó el adapter
  const io = SocketIoAdapter.ioServer;
  if (io) {
    const eventService = app.get(ChatwootEventService);
    eventService.namespace = io.of('/chatwoot');
  }
}
bootstrap();
