import { Controller, Get } from '@nestjs/common';
import { ColaboracionesService } from './colaboraciones.service';
import { Colaboracion } from './colaboraciones.entity';

@Controller('colaboraciones')
export class ColaboracionesController {

  constructor(private readonly colaboracionesService: ColaboracionesService) {}

  @Get()
  findAll(): Promise<Colaboracion[]> {
    return this.colaboracionesService.findAll();
  }
}