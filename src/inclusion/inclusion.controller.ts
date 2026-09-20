import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { InclusionService } from './inclusion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Datos personales sensibles: TODO el controlador es solo para admin.
// RolesGuard deja pasar si no hay @Roles, por eso @Roles('admin') va a nivel
// de clase. Sin @Public() y sin parámetros de consulta: cada reporte tiene un
// corte fijo (ver InclusionService).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('inclusion')
export class InclusionController {

  constructor(private readonly inclusionService: InclusionService) { }

  @Get('resumen')
  @Header('Cache-Control', 'no-store')
  getResumen() {
    return this.inclusionService.getResumen();
  }

  @Get('discapacidad-por-dominio')
  @Header('Cache-Control', 'no-store')
  getDiscapacidadPorDominio() {
    return this.inclusionService.getDiscapacidadPorDominio();
  }

  @Get('por-carrera')
  @Header('Cache-Control', 'no-store')
  getPorCarrera() {
    return this.inclusionService.getPorCarrera();
  }

  @Get('por-anio-egreso')
  @Header('Cache-Control', 'no-store')
  getPorAnioEgreso() {
    return this.inclusionService.getPorAnioEgreso();
  }
}
