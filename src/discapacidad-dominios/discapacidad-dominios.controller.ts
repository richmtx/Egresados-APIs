import { Controller, Get } from '@nestjs/common';
import { DiscapacidadDominiosService } from './discapacidad-dominios.service';
import { DiscapacidadDominio } from './discapacidad-dominios.entity';

@Controller('discapacidad-dominios')
export class DiscapacidadDominiosController {

  constructor(private readonly discapacidadDominiosService: DiscapacidadDominiosService) {}

  @Get()
  findAll(): Promise<DiscapacidadDominio[]> {
    return this.discapacidadDominiosService.findAll();
  }
}
