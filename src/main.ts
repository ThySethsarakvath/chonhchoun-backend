import * as dns from 'dns';

// Force Node.js to use public DNS resolvers to bypass local ISP DNS SRV resolution issues
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import * as express from 'express';


async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Serve any other static assets from /public (e.g. images served from /public/)
  app.use(express.static(join(process.cwd(), 'public')));

  // Global route prefix (applies to NestJS controllers).
  // 'track' and 'packages/track/*' are excluded so they resolve WITHOUT the api/v1 prefix.
  app.setGlobalPrefix('api/v1', {
    exclude: ['track', 'packages/track/(.*)'],
  });

  // Auto-validate all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS — allow the tracking page origin
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });


  const swaggerConfig = new DocumentBuilder()
    .setTitle('Chonh Choun API')
    .setDescription(
      'The Chonh Choun Delivery & KrubKrong ERP API documentation',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );
  SwaggerModule.setup(
    'api/docs',
    app,
    swaggerDocument,
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 API running on http://localhost:${port}/api/v1`);
  logger.log(`📦 Package tracking page: http://localhost:${port}/track`);
}

bootstrap();