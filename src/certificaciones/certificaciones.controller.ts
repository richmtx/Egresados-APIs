import { Controller, Get } from '@nestjs/common';
import { CertificacionesService } from './certificaciones.service';
import { Certificacion } from './certificaciones.entity';

@Controller('certificaciones')
export class CertificacionesController {

  constructor(private readonly certificacionesService: CertificacionesService) {}

  @Get()
  findAll(): Promise<Certificacion[]> {
    return this.certificacionesService.findAll();
  }
}