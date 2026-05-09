import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';

async function bootstrap() {

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  //app.setGlobalPrefix('api');

  app.enableCors();
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