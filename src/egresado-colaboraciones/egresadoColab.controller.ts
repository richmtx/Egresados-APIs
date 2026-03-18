import { Controller, Get } from '@nestjs/common';
import { EgresadoColabService } from './egresadoColab.service';
import { EgresadoColab } from './egresadoColab.entity';

@Controller('egresado-colaboraciones')
export class EgresadoColabController {

  constructor(private readonly egresadoColabService: EgresadoColabService) {}

  @Get()
  findAll(): Promise<EgresadoColab[]> {
    return this.egresadoColabService.findAll();
  }
}