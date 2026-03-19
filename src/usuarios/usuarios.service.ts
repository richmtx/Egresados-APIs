import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './usuarios.entity';

@Injectable()
export class UsuariosService {

  constructor(
    @InjectRepository(Usuario)
    private usuariosRepository: Repository<Usuario>,
  ) {}

  async findAll(): Promise<Usuario[]> {
    return this.usuariosRepository.find();
  }

  async findOne(id: number): Promise<Usuario | null> {
    return this.usuariosRepository.findOneBy({ id_usuario: id });
  }

  async create(data: Partial<Usuario>): Promise<Usuario> {
    const nuevoUsuario = this.usuariosRepository.create(data);
    return this.usuariosRepository.save(nuevoUsuario);
  }

  async update(id: number, data: Partial<Usuario>): Promise<any> {
    await this.usuariosRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number): Promise<any> {
    const usuario = await this.findOne(id);
    if (!usuario) {
      return { message: 'Usuario no encontrado' };
    }
    await this.usuariosRepository.delete(id);
    return { message: 'Usuario eliminado correctamente' };
  }
}