import { Controller, Get } from '@nestjs/common';
import { RespuestasAutoadscripcionService } from './respuestas-autoadscripcion.service';
import { RespuestaAutoadscripcion } from './respuestas-autoadscripcion.entity';

@Controller('respuestas-autoadscripcion')
export class RespuestasAutoadscripcionController {

  constructor(private readonly respuestasAutoadscripcionService: RespuestasAutoadscripcionService) {}

  @Get()
  findAll(): Promise<RespuestaAutoadscripcion[]> {
    return this.respuestasAutoadscripcionService.findAll();
  }
}
