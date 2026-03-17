import { Controller, Get } from '@nestjs/common';
import { CertificacionesVService } from './certificacionesV.service';
import { CertificacionVigente } from './certificacionesV.entity';

@Controller('certificaciones-vigentes')
export class CertificacionesVController {

  constructor(private readonly certificacionesVService: CertificacionesVService) {}

  @Get()
  findAll(): Promise<CertificacionVigente[]> {
    return this.certificacionesVService.findAll();
  }
}