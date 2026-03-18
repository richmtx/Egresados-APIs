import { Controller, Get } from '@nestjs/common';
import { CoincidenciaService } from './coincidencia.service';
import { Coincidencia } from './coincidencia.entity';

@Controller('coincidencia')
export class CoincidenciaController {

  constructor(private readonly coincidenciaService: CoincidenciaService) {}

  @Get()
  findAll(): Promise<Coincidencia[]> {
    return this.coincidenciaService.findAll();
  }
}