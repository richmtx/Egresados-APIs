import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, UnauthorizedException, BadRequestException,
  ParseIntPipe, Query, UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('usuarios')
export class UsuariosController {

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  async getUsuarios() {
    return this.usuariosService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('historial')
  async getHistorial(@Query('limite') limite?: string) {
    return this.usuariosService.getHistorial(limite ? parseInt(limite) : 50);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('historial/:id')
  async getHistorialUsuario(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.getHistorialPorUsuario(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('historial')
  async registrarAccion(
    @Body() body: { accion: string; descripcion: string; seccion: string },
    @Req() req: any,
  ) {
    await this.usuariosService.registrarAccion(
      req.user.id_usuario,
      body.accion,
      body.descripcion,
      body.seccion,
    );
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUsuario(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() body: { usuario: string; contrasena: string }) {
    const user = await this.usuariosService.login(body.usuario, body.contrasena);
    if (!user) throw new UnauthorizedException('Usuario o contraseña incorrectos');

    const payload = { sub: user.id_usuario, usuario: user.usuario, nombre_completo: user.nombre_completo, rol: user.rol };
    const access_token = this.jwtService.sign(payload);

    return { mensaje: 'Login exitoso', access_token, usuario: user };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('invitado')
  async crearInvitado(@Body() body: { nombre_completo: string }, @Req() req: any) {
    if (!body.nombre_completo)
      throw new BadRequestException('Falta campo requerido: nombre_completo');
    return this.usuariosService.crearInvitado(body.nombre_completo, req.user.id_usuario);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin')
  async crearAdmin(@Body() body: { nombre_completo: string }, @Req() req: any) {
    if (!body.nombre_completo)
      throw new BadRequestException('Falta campo requerido: nombre_completo');
    return this.usuariosService.crearAdmin(body.nombre_completo, req.user.id_usuario);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id/estado')
  async cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { estado: 'activo' | 'inactivo' },
    @Req() req: any,
  ) {
    return this.usuariosService.cambiarEstado(id, body.estado, req.user.id_usuario);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async deleteUsuario(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.usuariosService.remove(id, req.user.id_usuario);
  }
}
