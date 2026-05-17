import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UnauthorizedException, BadRequestException, ParseIntPipe, Query
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { Usuario } from './usuarios.entity';

@Controller('usuarios')
export class UsuariosController {

  constructor(private readonly usuariosService: UsuariosService) { }

  @Get()
  async getUsuarios() {
    return this.usuariosService.findAll();
  }

  @Get('historial')
  async getHistorial(@Query('limite') limite?: string) {
    return this.usuariosService.getHistorial(limite ? parseInt(limite) : 50);
  }

  @Get('historial/:id')
  async getHistorialUsuario(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.getHistorialPorUsuario(id);
  }

  @Get(':id')
  async getUsuario(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  @Post('login')
  async login(@Body() body: { usuario: string; contrasena: string }) {
    const user = await this.usuariosService.login(body.usuario, body.contrasena);
    if (!user) throw new UnauthorizedException('Usuario o contraseña incorrectos');
    return { mensaje: 'Login exitoso', usuario: user };
  }

  // POST /usuarios/invitado
  @Post('invitado')
  async crearInvitado(@Body() body: { nombre_completo: string; admin_id: number }) {
    if (!body.nombre_completo || !body.admin_id)
      throw new BadRequestException('Faltan campos requeridos: nombre_completo, admin_id');
    return this.usuariosService.crearInvitado(body.nombre_completo, body.admin_id);
  }

  // POST /usuarios/admin
  @Post('admin')
  async crearAdmin(@Body() body: { nombre_completo: string; admin_id: number }) {
    if (!body.nombre_completo || !body.admin_id)
      throw new BadRequestException('Faltan campos requeridos: nombre_completo, admin_id');
    return this.usuariosService.crearAdmin(body.nombre_completo, body.admin_id);
  }

  // PUT /usuarios/:id/estado
  @Put(':id/estado')
  async cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { estado: 'activo' | 'inactivo'; admin_id: number },
  ) {
    return this.usuariosService.cambiarEstado(id, body.estado, body.admin_id);
  }

  // DELETE /usuarios/:id — ahora puede eliminar admins también
  @Delete(':id')
  async deleteUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { admin_id: number },
  ) {
    if (!body.admin_id) throw new BadRequestException('Se requiere admin_id');
    return this.usuariosService.remove(id, body.admin_id);
  }
}