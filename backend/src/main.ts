import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { SocketIoAdapter } from './socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const bodyLimit = process.env.HTTP_BODY_LIMIT?.trim() || '20mb';

  // Evolution puede enviar media/base64 en webhooks, así que el límite por defecto
  // de Express (~100 KB) es insuficiente para imágenes y documentos.
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.enableCors({
    origin: true,
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
