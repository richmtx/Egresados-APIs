import { Controller, Get } from '@nestjs/common';
import { HabOtroService } from './habOtro.service';
import { HabOtro } from './habOtro.entity';

@Controller('habilidades-otro')
export class HabOtroController {

  constructor(private readonly habOtroService: HabOtroService) {}

  @Get()
  findAll(): Promise<HabOtro[]> {
    return this.habOtroService.findAll();
  }
}