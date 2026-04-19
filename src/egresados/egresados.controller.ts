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

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.egresadosService.remove(id);
  }
}