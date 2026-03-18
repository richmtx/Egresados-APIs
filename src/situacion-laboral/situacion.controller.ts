import { Controller, Get } from '@nestjs/common';
import { SituacionService } from './situacion.service';
import { Situacion } from './situacion.entity';

@Controller('situacion-laboral')
export class SituacionController {

  constructor(private readonly situacionService: SituacionService) {}

  @Get()
  findAll(): Promise<Situacion[]> {
    return this.situacionService.findAll();
  }
}