import { Controller, Get } from '@nestjs/common';
import { EgresadoHabService } from './egresadoHab.service';
import { EgresadoHab } from './egresadoHab.entity';

@Controller('egresado-habilidades')
export class EgresadoHabController {

  constructor(private readonly egresadoHabService: EgresadoHabService) {}

  @Get()
  findAll(): Promise<EgresadoHab[]> {
    return this.egresadoHabService.findAll();
  }
}