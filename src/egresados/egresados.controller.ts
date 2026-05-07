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
  getEgresadosPorColaboracion(
    @Query('tipo') tipo: string,
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosPorColaboracion(
      tipo,
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/habilidad')
  getEgresadosPorHabilidad(
    @Query('tipo') tipo: string,
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosPorHabilidad(
      tipo,
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/totales-colaboraciones')
  getTotalesColaboraciones(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getTotalesColaboraciones(
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/totales-habilidades')
  getTotalesHabilidades(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getTotalesHabilidades(
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/colaboracion-otro')
  getEgresadosColaboracionOtro(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosColaboracionOtro(
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/habilidad-otro')
  getEgresadosHabilidadOtro(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosHabilidadOtro(
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/distribucion-satisfaccion')
  getDistribucionSatisfaccion(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getDistribucionSatisfaccion(
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('estadisticas/genero')
  getEstadisticasGenero(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: number,
  ) {
    return this.egresadosService.getEstadisticasGenero(carrera, anio ? +anio : undefined);
  }

  @Get('vinculacion/autorizacion')
  getEgresadosPorAutorizacion(
    @Query('tipo') tipo: 'estadisticas' | 'contacto' | 'eventos',
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosPorAutorizacion(
      tipo,
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('comparativas')
  getComparativas(@Query('carreras') carrerasParam: string) {
    // Recibe: GET /egresados/comparativas?carreras=ISC,TICs,Ingeniería Informática
    const carreras = carrerasParam
      ? carrerasParam.split(',').map(c => c.trim()).filter(Boolean)
      : [];
    return this.egresadosService.getComparativas(carreras);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.egresadosService.remove(id);
  }
}