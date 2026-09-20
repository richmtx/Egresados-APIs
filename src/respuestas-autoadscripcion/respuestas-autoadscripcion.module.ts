import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RespuestaAutoadscripcion } from './respuestas-autoadscripcion.entity';
import { RespuestasAutoadscripcionService } from './respuestas-autoadscripcion.service';
import { RespuestasAutoadscripcionController } from './respuestas-autoadscripcion.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RespuestaAutoadscripcion])],
  controllers: [RespuestasAutoadscripcionController],
  providers: [RespuestasAutoadscripcionService],
})
export class RespuestasAutoadscripcionModule {}
