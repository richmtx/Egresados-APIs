import { Controller, Get } from '@nestjs/common';
import { TitulacionService } from './titulacion.service';
import { Titulacion } from './titulacion.entity';

@Controller('titulacion')
export class TitulacionController {

  constructor(private readonly titulacionService: TitulacionService) {}

  @Get()
  findAll(): Promise<Titulacion[]> {
    return this.titulacionService.findAll();
  }
}