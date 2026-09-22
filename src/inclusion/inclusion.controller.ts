import { Controller, Delete, Get, Header, Param, ParseIntPipe, Req, Res, UseGuards } from '@nestjs/common';
import { InclusionService } from './inclusion.service';
import { ExportInclusionService } from './export/export-inclusion.service';
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

  constructor(
    private readonly inclusionService: InclusionService,
    private readonly exportInclusionService: ExportInclusionService,
  ) { }

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

  @Get('identidad-por-pregunta')
  @Header('Cache-Control', 'no-store')
  getIdentidadPorPregunta() {
    return this.inclusionService.getIdentidadPorPregunta();
  }

  @Get('export/pdf')
  async exportarPdf(@Res() res: any) {
    const buffer = await this.exportInclusionService.exportarInclusionPdf();
    const fecha = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inclusion_${fecha}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('export/excel')
  async exportarExcel(@Res() res: any) {
    const buffer = await this.exportInclusionService.exportarInclusionExcel();
    const fecha = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="inclusion_${fecha}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // Solo el estado del consentimiento; nunca las respuestas.
  @Get('consentimiento/:id')
  @Header('Cache-Control', 'no-store')
  getConsentimiento(@Param('id', ParseIntPipe) id: number) {
    return this.inclusionService.getConsentimiento(id);
  }

  // Derecho de cancelación/oposición (ARCO): borra las respuestas de
  // inclusión sin eliminar el registro del egresado.
  @Delete('consentimiento/:id')
  @Header('Cache-Control', 'no-store')
  retirarConsentimiento(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.inclusionService.retirarConsentimiento(id, req.user.id_usuario);
  }
}
