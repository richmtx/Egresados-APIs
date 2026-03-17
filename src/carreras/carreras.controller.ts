import { Controller, Get } from '@nestjs/common';
import { CarrerasService } from './carreras.service';
import { Carrera } from './carreras.entity';

@Controller('carreras')
export class CarrerasController {

  constructor(private readonly carrerasService: CarrerasService) {}

  @Get()
  findAll(): Promise<Carrera[]> {
    return this.carrerasService.findAll();
  }
}