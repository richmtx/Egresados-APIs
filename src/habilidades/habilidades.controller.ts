import { Controller, Get } from '@nestjs/common';
import { HabilidadesService } from './habilidades.service';
import { Habilidad } from './habilidades.entity';

@Controller('habilidades')
export class HabilidadesController {

  constructor(private readonly habilidadesService: HabilidadesService) {}

  @Get()
  findAll(): Promise<Habilidad[]> {
    return this.habilidadesService.findAll();
  }
}