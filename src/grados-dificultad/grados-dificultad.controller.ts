import { Controller, Get } from '@nestjs/common';
import { GradosDificultadService } from './grados-dificultad.service';
import { GradoDificultad } from './grados-dificultad.entity';

@Controller('grados-dificultad')
export class GradosDificultadController {

  constructor(private readonly gradosDificultadService: GradosDificultadService) {}

  @Get()
  findAll(): Promise<GradoDificultad[]> {
    return this.gradosDificultadService.findAll();
  }
}
