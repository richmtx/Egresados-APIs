import { Controller, Get } from '@nestjs/common';
import { AutorizacionesService } from './autorizaciones.service';
import { Autorizacion } from './autorizaciones.entity';

@Controller('autorizaciones')
export class AutorizacionesController {

  constructor(private readonly autorizacionesService: AutorizacionesService) {}

  @Get()
  findAll(): Promise<Autorizacion[]> {
    return this.autorizacionesService.findAll();
  }
}