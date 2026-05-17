import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './usuarios.entity';
import { HistorialActividad } from './historial-actividad.entity';

@Injectable()
export class UsuariosService {

  constructor(
    @InjectRepository(Usuario)
    private usuariosRepository: Repository<Usuario>,
    @InjectRepository(HistorialActividad)
    private historialRepository: Repository<HistorialActividad>,
  ) { }

  async findAll(): Promise<Omit<Usuario, 'contrasena'>[]> {
    const usuarios = await this.usuariosRepository.find({
      order: { fecha_creacion: 'ASC' },
    });
    return usuarios.map(({ contrasena, ...u }) => u);
  }

  async findOne(id: number): Promise<Usuario | null> {
    return this.usuariosRepository.findOneBy({ id_usuario: id });
  }

  async login(usuario: string, contrasena: string): Promise<Omit<Usuario, 'contrasena'> | null> {
    const user = await this.usuariosRepository.findOneBy({ usuario, contrasena });

    if (!user) return null;
    if (user.estado === 'inactivo') return null;

    // Actualizar ultimo_acceso
    await this.usuariosRepository.update(user.id_usuario, {
      ultimo_acceso: new Date(),
    });

    // Registrar en historial
    await this.registrarAccion(user.id_usuario, 'login', `Inicio de sesión`, 'sistema');

    const { contrasena: _, ...resultado } = user;
    return resultado;
  }

  // Crea únicamente usuarios con rol invitado
  async crearInvitado(nombre_completo: string, adminId: number): Promise<{ usuario: Omit<Usuario, 'contrasena'>; contrasena_temporal: string }> {
    const usuarioGenerado = this.generarNombreUsuario(nombre_completo);
    const contrasenaGenerada = this.generarContrasena();

    const existe = await this.usuariosRepository.findOneBy({ usuario: usuarioGenerado });
    if (existe) {
      throw new BadRequestException('Ya existe un usuario con ese nombre. Intenta con un nombre diferente.');
    }

    const nuevo = this.usuariosRepository.create({
      nombre_completo,
      usuario: usuarioGenerado,
      contrasena: contrasenaGenerada,
      rol: 'invitado',
      estado: 'activo',
    });

    const guardado = await this.usuariosRepository.save(nuevo);

    await this.registrarAccion(
      adminId,
      'crear_usuario',
      `Creó usuario invitado: ${usuarioGenerado}`,
      'usuarios',
    );

    const { contrasena: _, ...sinContrasena } = guardado;
    return { usuario: sinContrasena, contrasena_temporal: contrasenaGenerada };
  }

  async cambiarEstado(id: number, estado: 'activo' | 'inactivo', adminId: number): Promise<any> {
    const usuario = await this.findOne(id);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (usuario.rol === 'admin') throw new BadRequestException('No se puede modificar el estado de un admin');

    await this.usuariosRepository.update(id, { estado });

    await this.registrarAccion(
      adminId,
      'cambiar_estado',
      `Cambió estado de ${usuario.usuario} a ${estado}`,
      'usuarios',
    );

    return { message: `Usuario ${estado} correctamente` };
  }

  async remove(id: number, adminId: number): Promise<any> {
    const usuario = await this.findOne(id);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (usuario.rol === 'admin') throw new BadRequestException('No se puede eliminar un admin principal');

    await this.registrarAccion(
      adminId,
      'eliminar_usuario',
      `Eliminó usuario invitado: ${usuario.usuario}`,
      'usuarios',
    );

    await this.usuariosRepository.delete(id);
    return { message: 'Usuario eliminado correctamente' };
  }

  async getHistorial(limite: number = 50): Promise<HistorialActividad[]> {
    return this.historialRepository.find({
      relations: ['usuario'],
      order: { fecha_accion: 'DESC' },
      take: limite,
    });
  }

  async getHistorialPorUsuario(id: number): Promise<HistorialActividad[]> {
    return this.historialRepository.find({
      where: { usuario: { id_usuario: id } },
      order: { fecha_accion: 'DESC' },
    });
  }

  // Método público para que otros servicios registren acciones
  async registrarAccion(
    id_usuario: number,
    accion: string,
    descripcion: string,
    seccion: string,
  ): Promise<void> {
    const entrada = this.historialRepository.create({
      usuario: { id_usuario } as Usuario,
      accion,
      descripcion,
      seccion,
    });
    await this.historialRepository.save(entrada);
  }

  // Genera "invitado_iniciales+año" ej: invitado_rm2025
  private generarNombreUsuario(nombre_completo: string): string {
    const partes = nombre_completo.trim().toLowerCase().split(' ');
    const iniciales = partes.map(p => p[0]).join('').slice(0, 3);
    const anio = new Date().getFullYear();
    return `invitado_${iniciales}${anio}`;
  }

  // Genera contraseña aleatoria de 10 caracteres
  private generarContrasena(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}