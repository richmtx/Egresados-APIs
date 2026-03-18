import { Controller, Get } from '@nestjs/common';
import { ColabOtroService } from './colabOtro.service';
import { ColabOtro } from './colabOtro.entity';

@Controller('colaboracion-otro')
export class ColabOtroController {

  constructor(private readonly colabOtroService: ColabOtroService) {}

  @Get()
  findAll(): Promise<ColabOtro[]> {
    return this.colabOtroService.findAll();
  }
}