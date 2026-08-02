/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  Sistema de Seguimiento de Egresados · ITD                     ║
 * ║  API REST — NestJS · TypeORM · MySQL                           ║
 * ║                                                                ║
 * ║  @author   Ricardo Martínez Hernández (richmtx)                ║
 * ║  @contact  rich.mtx1205@gmail.com                              ║
 * ║  @repo     https://github.com/richmtx/Egresados-APIs           ║
 * ║  @year     2026                                                ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ── Forzar UTF-8 en todas las respuestas JSON ──
  app.use((req: any, res: any, next: any) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  app.enableCors();

  // ── Límite de body para recibir imágenes base64 de gráficas (~3-5 MB) ──
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  console.log(`🚀 Servidor corriendo en: http://localhost:${port}`);

}

bootstrap();