import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? '*';
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const redisUrl = config.get<string>('REDIS_URL');
  if (redisUrl) {
    const redisAdapter = new RedisIoAdapter(app, redisUrl, corsOrigin);
    try {
      await redisAdapter.connectToRedis();
      app.useWebSocketAdapter(redisAdapter);
    } catch (err) {
      logger.warn(
        `Could not connect Redis adapter, falling back to in-memory: ${(err as Error).message}`,
      );
    }
  }

  const port = Number(config.get<string>('API_PORT') ?? '4000');
  await app.listen(port, '0.0.0.0');
  logger.log(`Omnicom API listening on port ${port}`);
}

void bootstrap();
