import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {

  const app = await NestFactory.create(AppModule);

  //app.setGlobalPrefix('api');

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Puerto
  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  console.log(`🚀 Servidor corriendo en: http://localhost:${port}`);
  //console.log(`📡 API disponible en: http://localhost:${port}/api`);

}

bootstrap();