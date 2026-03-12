import { Controller, Get } from '@nestjs/common';
import { EgresadosService } from './egresados.service';
import { Egresado } from './egresados.entity';

@Controller('egresados')
export class EgresadosController {

  constructor(private readonly egresadosService: EgresadosService) {}

  @Get()
  findAll(): Promise<Egresado[]> {
    return this.egresadosService.findAll();
  }

}