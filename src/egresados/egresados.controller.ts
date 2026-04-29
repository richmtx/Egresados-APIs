import { Controller, Get, Post, Patch, Body, Param, Query, ParseIntPipe, Delete, } from '@nestjs/common';
import { EgresadosService } from './egresados.service';
import { CreateEgresadoEtapa1Dto } from './dto/create-egresado-etapa1.dto';
import { CreateEgresadoEtapa2Dto } from './dto/create-egresado-etapa2.dto';

@Controller('egresados')
export class EgresadosController {

  constructor(private readonly egresadosService: EgresadosService) { }

  @Post('etapa1')
  crearEtapa1(@Body() dto: CreateEgresadoEtapa1Dto) {
    return this.egresadosService.crearEtapa1(dto);
  }

  @Patch('etapa2/:id')
  completarEtapa2(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateEgresadoEtapa2Dto,
  ) {
    return this.egresadosService.completarEtapa2(id, dto);
  }

  @Get('buscar')
  buscarPorCorreo(@Query('correo') correo: string) {
    return this.egresadosService.buscarPorCorreo(correo);
  }

  @Get()
  findAll() {
    return this.egresadosService.findAll();
  }

  @Get('detalles')
  findAllConDetalles() {
    return this.egresadosService.findAllConDetalles();
  }

  @Get(':id/perfil')
  getPerfil(@Param('id', ParseIntPipe) id: number) {
    return this.egresadosService.getPerfil(id);
  }

  @Get('estadisticas')
  getEstadisticas(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEstadisticas(
      carrera,
      anio ? parseInt(anio) : undefined,
    );
  }

  @Get('distribucion-geografica')
  getDistribucionGeografica(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getDistribucionGeografica(
      carrera,
      anio ? Number(anio) : undefined,
    );
  }

  @Get('vinculacion/colaboracion')
  getEgresadosPorColaboracion(@Query('tipo') tipo: string) {
    return this.egresadosService.getEgresadosPorColaboracion(tipo);
  }

  @Get('vinculacion/habilidad')
  getEgresadosPorHabilidad(@Query('tipo') tipo: string) {
    return this.egresadosService.getEgresadosPorHabilidad(tipo);
  }

  @Get('vinculacion/autorizacion')
  getEgresadosPorAutorizacion(
    @Query('tipo') tipo: 'estadisticas' | 'contacto' | 'eventos',
  ) {
    return this.egresadosService.getEgresadosPorAutorizacion(tipo);
  }

  @Get('vinculacion/totales-colaboraciones')
  getTotalesColaboraciones() {
    return this.egresadosService.getTotalesColaboraciones();
  }

  @Get('vinculacion/totales-habilidades')
  getTotalesHabilidades() {
    return this.egresadosService.getTotalesHabilidades();
  }

  @Get('vinculacion/colaboracion-otro')
  getEgresadosColaboracionOtro() {
    return this.egresadosService.getEgresadosColaboracionOtro();
  }

  @Get('vinculacion/habilidad-otro')
  getEgresadosHabilidadOtro() {
    return this.egresadosService.getEgresadosHabilidadOtro();
  }

  @Get('vinculacion/distribucion-satisfaccion')
  getDistribucionSatisfaccion() {
    return this.egresadosService.getDistribucionSatisfaccion();
  }

  @Get('estadisticas/genero')
  getEstadisticasGenero(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: number,
  ) {
    return this.egresadosService.getEstadisticasGenero(carrera, anio ? +anio : undefined);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.egresadosService.remove(id);
  }
}