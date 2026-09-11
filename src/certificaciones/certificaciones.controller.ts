import { Controller, Get, UseGuards } from '@nestjs/common';
import { CertificacionesService } from './certificaciones.service';
import { Certificacion } from './certificaciones.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('certificaciones')
export class CertificacionesController {

  constructor(private readonly certificacionesService: CertificacionesService) {}

  @Get()
  findAll(): Promise<Certificacion[]> {
    return this.certificacionesService.findAll();
  }
}