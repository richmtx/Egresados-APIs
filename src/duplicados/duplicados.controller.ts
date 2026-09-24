import { Body, Controller, Get, Header, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DuplicadosService } from './duplicados.service';
import { ListarDuplicadosDto } from './dto/listar-duplicados.dto';
import { DescartarDuplicadoDto } from './dto/descartar-duplicado.dto';
import { FusionarDuplicadosDto } from './dto/fusionar-duplicados.dto';
import { ListarFusionesDto } from './dto/listar-fusiones.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Expone datos personales de egresados lado a lado: TODO el controlador es
// solo para admin. RolesGuard deja pasar si no hay @Roles, por eso
// @Roles('admin') va a nivel de clase. Sin @Public().
// La fusión es la única ruta de este módulo que BORRA egresados, y solo
// entre registros que el detector ya conectó como candidatos.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('duplicados')
export class DuplicadosController {

  constructor(private readonly duplicadosService: DuplicadosService) { }

  @Post('detectar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  detectar(@Req() req: any) {
    return this.duplicadosService.detectar(req.user.id_usuario);
  }

  // Declarado antes de cualquier ruta con :id.
  @Get('resumen')
  @Header('Cache-Control', 'no-store')
  getResumen() {
    return this.duplicadosService.getResumen();
  }

  @Get('fusiones')
  @Header('Cache-Control', 'no-store')
  listarFusiones(@Query() query: ListarFusionesDto) {
    return this.duplicadosService.listarFusiones(query);
  }

  @Get('fusiones/:id')
  @Header('Cache-Control', 'no-store')
  getFusion(@Param('id', ParseIntPipe) id: number) {
    return this.duplicadosService.getFusion(id);
  }

  @Post('fusionar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  fusionar(@Body() body: FusionarDuplicadosDto, @Req() req: any) {
    return this.duplicadosService.fusionar(body, req.user.usuario, req.user.id_usuario);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(@Query() query: ListarDuplicadosDto) {
    return this.duplicadosService.listar(query);
  }

  @Patch(':id/descartar')
  @Header('Cache-Control', 'no-store')
  descartar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DescartarDuplicadoDto,
    @Req() req: any,
  ) {
    return this.duplicadosService.descartar(id, req.user.usuario, req.user.id_usuario, body.notas);
  }
}
