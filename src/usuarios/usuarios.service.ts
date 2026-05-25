import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
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
    const user = await this.usuariosRepository.findOneBy({ usuario });
    if (!user || user.estado === 'inactivo') return null;

    const esBcrypt = user.contrasena.startsWith('$2b$') || user.contrasena.startsWith('$2a$');
    let passwordMatch: boolean;

    if (esBcrypt) {
      passwordMatch = await bcrypt.compare(contrasena, user.contrasena);
    } else {
      // Auto-migración: contraseña legacy en texto plano
      passwordMatch = user.contrasena === contrasena;
      if (passwordMatch) {
        const hashed = await bcrypt.hash(contrasena, 10);
        await this.usuariosRepository.update(user.id_usuario, { contrasena: hashed });
      }
    }

    if (!passwordMatch) return null;

    await this.usuariosRepository.update(user.id_usuario, { ultimo_acceso: new Date() });
    await this.registrarAccion(user.id_usuario, 'login', 'Inicio de sesión', 'sistema');

    const { contrasena: _, ...resultado } = user;
    return resultado;
  }

  // Crear usuario invitado
  async crearInvitado(nombre_completo: string, adminId: number): Promise<{ usuario: Omit<Usuario, 'contrasena'>; contrasena_temporal: string }> {
    const usuarioGenerado = this.generarNombreUsuario(nombre_completo, 'invitado');
    const contrasenaGenerada = this.generarContrasena();

    const existe = await this.usuariosRepository.findOneBy({ usuario: usuarioGenerado });
    if (existe) throw new BadRequestException('Ya existe un usuario con ese nombre. Intenta con un nombre diferente.');

    const nuevo = this.usuariosRepository.create({
      nombre_completo,
      usuario: usuarioGenerado,
      contrasena: await bcrypt.hash(contrasenaGenerada, 10),
      rol: 'invitado',
      estado: 'activo',
    });

    const guardado = await this.usuariosRepository.save(nuevo);
    await this.registrarAccion(adminId, 'crear_usuario', `Creó usuario invitado: ${usuarioGenerado}`, 'usuarios');

    const { contrasena: _, ...sinContrasena } = guardado;
    return { usuario: sinContrasena, contrasena_temporal: contrasenaGenerada };
  }

  // Crear usuario admin
  async crearAdmin(nombre_completo: string, adminId: number): Promise<{ usuario: Omit<Usuario, 'contrasena'>; contrasena_temporal: string }> {
    const usuarioGenerado = this.generarNombreUsuario(nombre_completo, 'admin');
    const contrasenaGenerada = this.generarContrasena();

    const existe = await this.usuariosRepository.findOneBy({ usuario: usuarioGenerado });
    if (existe) throw new BadRequestException('Ya existe un usuario con ese nombre. Intenta con un nombre diferente.');

    const nuevo = this.usuariosRepository.create({
      nombre_completo,
      usuario: usuarioGenerado,
      contrasena: await bcrypt.hash(contrasenaGenerada, 10),
      rol: 'admin',
      estado: 'activo',
    });

    const guardado = await this.usuariosRepository.save(nuevo);
    await this.registrarAccion(adminId, 'crear_usuario', `Creó usuario admin: ${usuarioGenerado}`, 'usuarios');

    const { contrasena: _, ...sinContrasena } = guardado;
    return { usuario: sinContrasena, contrasena_temporal: contrasenaGenerada };
  }

  async cambiarEstado(id: number, estado: 'activo' | 'inactivo', adminId: number): Promise<any> {
    const usuario = await this.findOne(id);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // Si es admin e inactivo, verificar que quede al menos 1 admin activo
    if (usuario.rol === 'admin' && estado === 'inactivo') {
      const adminsActivos = await this.usuariosRepository.count({
        where: { rol: 'admin', estado: 'activo' },
      });
      if (adminsActivos <= 1) {
        throw new BadRequestException('No puedes desactivar al último admin activo del sistema.');
      }
    }

    await this.usuariosRepository.update(id, { estado });
    await this.registrarAccion(adminId, 'cambiar_estado', `Cambió estado de ${usuario.usuario} a ${estado}`, 'usuarios');

    return { message: `Usuario ${estado} correctamente` };
  }

  async remove(id: number, adminId: number): Promise<any> {
    const usuario = await this.findOne(id);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // Evitar que se elimine a sí mismo
    if (id === adminId) throw new BadRequestException('No puedes eliminarte a ti mismo.');

    // Si es admin, verificar que quede al menos 1 admin
    if (usuario.rol === 'admin') {
      const totalAdmins = await this.usuariosRepository.count({ where: { rol: 'admin' } });
      if (totalAdmins <= 1) {
        throw new BadRequestException('No puedes eliminar al último admin del sistema.');
      }
    }

    await this.registrarAccion(
      adminId,
      'eliminar_usuario',
      `Eliminó usuario ${usuario.rol}: ${usuario.usuario}`,
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

  async registrarAccion(id_usuario: number, accion: string, descripcion: string, seccion: string): Promise<void> {
    const entrada = this.historialRepository.create({
      usuario: { id_usuario } as Usuario,
      accion,
      descripcion,
      seccion,
    });
    await this.historialRepository.save(entrada);
  }

  // Prefijo diferente según rol: admin_rm2025 / invitado_rm2025
  private generarNombreUsuario(nombre_completo: string, rol: 'admin' | 'invitado'): string {
    const partes = nombre_completo.trim().toLowerCase().split(' ');
    const iniciales = partes.map(p => p[0]).join('').slice(0, 3);
    const anio = new Date().getFullYear();
    return `${rol}_${iniciales}${anio}`;
  }

  private generarContrasena(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}