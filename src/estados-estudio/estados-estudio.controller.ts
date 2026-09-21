import { Controller, Get } from '@nestjs/common';
import { EstadosEstudioService } from './estados-estudio.service';
import { EstadoEstudio } from './estados-estudio.entity';

@Controller('estados-estudio')
export class EstadosEstudioController {

  constructor(private readonly estadosEstudioService: EstadosEstudioService) {}

  @Get()
  findAll(): Promise<EstadoEstudio[]> {
    return this.estadosEstudioService.findAll();
  }
}
