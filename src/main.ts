import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  //app.setGlobalPrefix('api');

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

  // Sirve la carpeta uploads/ como archivos estáticos
  // Las fotos quedan accesibles en: http://localhost:3000/uploads/fotos/<archivo>
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Puerto
  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  console.log(`🚀 Servidor corriendo en: http://localhost:${port}`);
  //console.log(`📡 API disponible en: http://localhost:${port}/api`);

}

bootstrap();