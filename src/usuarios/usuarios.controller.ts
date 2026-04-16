import { Controller, Get, Post, Put, Delete, Param, Body, UnauthorizedException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { Usuario } from './usuarios.entity';

@Controller('usuarios')
export class UsuariosController {

  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  async getUsuarios(): Promise<Usuario[]> {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  async getUsuario(@Param('id') id: number): Promise<Usuario | null> {
    return this.usuariosService.findOne(id);
  }

  @Post('login')
  async login(@Body() body: { usuario: string; contrasena: string }) {
    const user = await this.usuariosService.login(body.usuario, body.contrasena);

    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    return {
      mensaje: 'Login exitoso',
      usuario: user,
    };
  }

  @Post()
  async createUsuario(@Body() body: Partial<Usuario>): Promise<Usuario> {
    return this.usuariosService.create(body);
  }

  @Put(':id')
  async updateUsuario(
    @Param('id') id: number,
    @Body() body: Partial<Usuario>,
  ): Promise<Usuario | null> {
    return this.usuariosService.update(id, body);
  }

  @Delete(':id')
  async deleteUsuario(@Param('id') id: number): Promise<any> {
    return this.usuariosService.remove(id);
  }
}