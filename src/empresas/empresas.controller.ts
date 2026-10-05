import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { EmpresasService } from './empresas.service';
import { ListarCandidatosEmpresaDto } from './dto/listar-candidatos-empresa.dto';
import { ListarEmpresasDto } from './dto/listar-empresas.dto';
import { FusionarEmpresasDto } from './dto/fusionar-empresas.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Catálogo canónico de empresas y revisión de variantes de nombre: TODO el
// controlador es solo para admin. RolesGuard deja pasar si no hay @Roles, por
// eso @Roles('admin') va a nivel de clase. Sin @Public().
// Ninguna ruta toca los textos `empresa` / `primer_empleo_empresa` de
// egresados: la fusión solo llena las FK empresa_id / primer_empleo_empresa_id.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/empresas')
export class EmpresasController {

  constructor(private readonly empresasService: EmpresasService) { }

  @Post('detectar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  detectar(@Req() req: any) {
    return this.empresasService.detectar(req.user.id_usuario);
  }

  @Get('candidatos')
  @Header('Cache-Control', 'no-store')
  listarCandidatos(@Query() query: ListarCandidatosEmpresaDto) {
    return this.empresasService.listarCandidatos(query);
  }

  @Post('candidatos/:id/descartar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  descartar(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.empresasService.descartar(id, req.user.usuario, req.user.id_usuario);
  }

  @Post('fusionar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  fusionar(@Body() body: FusionarEmpresasDto, @Req() req: any) {
    return this.empresasService.fusionar(body, req.user.usuario, req.user.id_usuario);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(@Query() query: ListarEmpresasDto) {
    return this.empresasService.listar(query);
  }

  @Delete(':id_empresa')
  @Header('Cache-Control', 'no-store')
  eliminar(@Param('id_empresa', ParseIntPipe) idEmpresa: number, @Req() req: any) {
    return this.empresasService.eliminar(idEmpresa, req.user.id_usuario);
  }
}
